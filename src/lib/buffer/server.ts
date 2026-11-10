import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Database } from '@/db'
import { album, volume } from '@/db/schema'
import {
  DriveNotFoundError,
  createDriveFolder,
  deleteDriveFile,
  getDriveFileMeta,
  mintResumableUpload,
  shareWithWriter,
} from '@/lib/google/google-drive'
import { withGoogleToken } from '@/lib/google/google-calendar-auth'
import { isImage } from '@/lib/albums/drive-photo'
import { addPhotoRow, hasBufferPhotoRow } from '@/lib/albums/photo-store'
import { newId } from '@/lib/albums/ids'
import { nextVolumeNumber } from '@/lib/albums/volume-number'
import { hasOffloadPending } from '@/lib/albums/offload-pending'
import {
  BUFFER_SOURCE_KEY,
  bufferSourceKey,
  volumeIdFromSourceKey,
} from '@/lib/albums/listing'
import { pickVolumeWithRoom } from '@/lib/albums/volume-limit'
import { isInVolumeFolder, volumeFolderName } from '@/lib/pool/volumes'
import {
  bufferUploadMessage,
  decideMissingVolumeFolder,
  planVolumeSetup,
} from './plan'
import { clearState, getBufferPlan, setBufferGrantState } from './grant'
import { MOVING_ALBUM_MESSAGE, OFFLOADED_ALBUM_MESSAGE } from './messages'
import { withBufferToken } from './tokens'
import { bufferUploadBlock } from './usage'
import { getBufferOverview } from './usage-server'

const UPLOAD_USAGE_MAX_AGE_MS = 10 * 60 * 1000

const bufferVolumes = (albumId: string) =>
  and(
    eq(volume.albumId, albumId),
    isNull(volume.flamekeeperUserId),
    isNull(volume.droppedAt)
  )

export async function ensureBufferVolume(
  database: Database,
  masterToken: string,
  albumRow: { id: string; driveFolderId: string },
  buffer: { email: string; grantId: string | null },
  incomingBytes: number,
  pendingBytes: Map<string, number> = new Map(),
  attempt = 0
): Promise<{ volumeId: string; folderId: string }> {
  const bufferEmail = buffer.email
  const loadAll = () =>
    database
      .select({
        id: volume.id,
        driveFolderId: volume.driveFolderId,
        permissionId: volume.permissionId,
        expectedBytes: volume.expectedBytes,
      })
      .from(volume)
      .where(bufferVolumes(albumRow.id))
      .orderBy(asc(volume.createdAt), asc(volume.id))
      .all()

  const existing = pickVolumeWithRoom(
    (await loadAll()).map((v) => ({
      ...v,
      expectedBytes: (v.expectedBytes ?? 0) + (pendingBytes.get(v.id) ?? 0),
    })),
    incomingBytes
  )
  const setup = planVolumeSetup(existing)
  if (existing && !setup.create && !setup.share) {
    return { volumeId: existing.id, folderId: existing.driveFolderId! }
  }

  let volumeId = existing?.id ?? null
  let folderId = existing?.driveFolderId ?? null
  if (setup.create) {
    const number = await nextVolumeNumber(database, albumRow.id)
    const created = await createDriveFolder(
      masterToken,
      volumeFolderName(number, newId(6)),
      albumRow.driveFolderId
    )
    const newVolumeId = volumeId ?? newId(10)
    let claimed: { meta?: { changes?: number } }
    try {
      claimed = existing
        ? await database
            .update(volume)
            .set({
              driveFolderId: created.id,
              permissionId: '',
              number: sql`COALESCE(${volume.number}, ${number})`,
            })
            .where(
              and(
                eq(volume.id, existing.id),
                sql`${volume.driveFolderId} IS NULL`
              )
            )
        : await database.insert(volume).values({
            id: newVolumeId,
            albumId: albumRow.id,
            driveFolderId: created.id,
            number,
            bufferGrantId: buffer.grantId,
            expectedCount: 0,
            expectedBytes: 0,
          })
    } catch (error) {
      try {
        await deleteDriveFile(masterToken, created.id)
      } catch (cleanup) {
        console.warn('Failed to delete a spare buffer volume folder:', cleanup)
      }
      if (attempt >= 2) throw error
      return ensureBufferVolume(
        database,
        masterToken,
        albumRow,
        buffer,
        incomingBytes,
        pendingBytes,
        attempt + 1
      )
    }
    if ((claimed.meta?.changes ?? 0) > 0) {
      volumeId = newVolumeId
      folderId = created.id
    } else {
      try {
        await deleteDriveFile(masterToken, created.id)
      } catch (error) {
        console.warn('Failed to delete a spare buffer volume folder:', error)
      }
      const winner = (await loadAll()).find((v) => v.id === existing?.id)
      if (!winner?.driveFolderId) {
        throw new Error('Could not set up the album storage, try again')
      }
      if (winner.permissionId) {
        return { volumeId: winner.id, folderId: winner.driveFolderId }
      }
      volumeId = winner.id
      folderId = winner.driveFolderId
    }
  }

  const permissionId = await shareWithWriter(
    masterToken,
    folderId!,
    bufferEmail
  )
  await database
    .update(volume)
    .set({ permissionId })
    .where(eq(volume.id, volumeId!))
  return { volumeId: volumeId!, folderId: folderId! }
}

async function forgetBufferVolumeFolder(
  database: Database,
  volumeId: string
): Promise<void> {
  await database
    .update(volume)
    .set({ driveFolderId: null, permissionId: '' })
    .where(eq(volume.id, volumeId))
}

async function volumeHasPhotos(
  database: Database,
  volumeId: string
): Promise<boolean> {
  const row = await database
    .select({ expectedCount: volume.expectedCount })
    .from(volume)
    .where(eq(volume.id, volumeId))
    .get()
  return (row?.expectedCount ?? 0) > 0
}

async function albumUploadBlock(
  database: Database,
  albumId: string
): Promise<string | null> {
  const held = await database
    .select({ id: volume.id })
    .from(volume)
    .where(
      and(
        eq(volume.albumId, albumId),
        isNotNull(volume.flamekeeperUserId),
        isNull(volume.droppedAt)
      )
    )
    .limit(1)
    .get()
  if (held) return OFFLOADED_ALBUM_MESSAGE
  if (await hasOffloadPending(albumId, false)) return MOVING_ALBUM_MESSAGE
  return null
}

export async function startBufferUpload(
  database: Database,
  albumRow: { id: string; driveFolderId: string },
  file: { name: string; mimeType: string; bytes: number; origin?: string }
): Promise<{ uploadUrl: string }> {
  const plan = await getBufferPlan(database)
  if (plan.kind === 'unavailable') {
    console.warn(
      `Buffer is not configured, missing: ${plan.missing.join(', ')}`
    )
    throw new Error(plan.message)
  }

  const blocked = bufferUploadBlock(
    await getBufferOverview(UPLOAD_USAGE_MAX_AGE_MS)
  )
  if (blocked) throw new Error(blocked)
  const moving = await albumUploadBlock(database, albumRow.id)
  if (moving) throw new Error(moving)

  let retried = false
  let currentVolumeId: string | null = null
  while (true) {
    try {
      const { volumeId, folderId } = await withGoogleToken((token) =>
        ensureBufferVolume(database, token, albumRow, plan, file.bytes)
      )
      currentVolumeId = volumeId
      const uploadUrl = await withBufferToken(
        (token) =>
          mintResumableUpload(token, {
            name: file.name,
            folderId,
            mimeType: file.mimeType,
            size: file.bytes,
            origin: file.origin,
          }),
        undefined,
        plan.grantId
      )
      if (plan.grantId)
        await clearState(plan.grantId, 'missing').catch(() => {})
      return { uploadUrl }
    } catch (error) {
      if (error instanceof DriveNotFoundError) {
        const decision = decideMissingVolumeFolder({
          hasPhotos: currentVolumeId
            ? await volumeHasPhotos(database, currentVolumeId)
            : true,
          retried,
        })
        if (decision === 'recreate' && currentVolumeId) {
          await forgetBufferVolumeFolder(database, currentVolumeId)
          retried = true
          continue
        }
        if (plan.grantId) {
          await setBufferGrantState(plan.grantId, 'missing').catch(() => {})
        }
        throw new Error(
          'The album storage folder could not be found in Google Drive, so uploads are paused.'
        )
      }
      const message = bufferUploadMessage(error)
      if (message) {
        console.warn('Buffer upload could not start:', error)
        throw new Error(message)
      }
      throw error
    }
  }
}

export async function confirmBufferUpload(
  database: Database,
  albumRow: { id: string; driveFolderId: string },
  fileId: string
): Promise<boolean> {
  const volumeRows = await database
    .select({ id: volume.id, driveFolderId: volume.driveFolderId })
    .from(volume)
    .where(bufferVolumes(albumRow.id))
    .orderBy(asc(volume.createdAt), asc(volume.id))
    .all()

  const file = await withBufferToken((token) => getDriveFileMeta(token, fileId))
  const target = volumeRows.find((v) => isInVolumeFolder(file, v.driveFolderId))
  if (!target) {
    throw new Error('Uploaded file not found in the album folder')
  }

  if (!isImage(file)) {
    await withBufferToken((token) => deleteDriveFile(token, fileId))
    return false
  }

  if (await hasBufferPhotoRow(database, albumRow.id, fileId)) return true

  // The first buffer volume lists under the plain key, the rest by id.
  const sourceKey =
    target.id === volumeRows[0].id
      ? BUFFER_SOURCE_KEY
      : bufferSourceKey(target.id)
  const { parents: _parents, trashed: _trashed, ...listed } = file
  await addPhotoRow(database, albumRow.id, sourceKey, listed)

  const bytes = Number(file.size ?? 0) || 0
  await adjustExpected(database, target.id, 1, bytes)
  await database
    .update(album)
    .set({
      photoCount: sql`${album.photoCount} + 1`,
      photoBytes: sql`${album.photoBytes} + ${bytes}`,
    })
    .where(eq(album.id, albumRow.id))
  return true
}

export async function adjustExpected(
  database: Database,
  volumeId: string,
  countDelta: number,
  bytesDelta: number
): Promise<void> {
  await database
    .update(volume)
    .set({
      expectedCount: sql`MAX(COALESCE(${volume.expectedCount}, 0) + ${countDelta}, 0)`,
      expectedBytes: sql`MAX(COALESCE(${volume.expectedBytes}, 0) + ${bytesDelta}, 0)`,
      expectedChangedAt: new Date(),
    })
    .where(eq(volume.id, volumeId))
}

export async function adjustExpectedByKey(
  database: Database,
  albumId: string,
  volumeKey: string,
  countDelta: number,
  bytesDelta: number
): Promise<void> {
  const volumeId = await resolveVolumeId(database, albumId, volumeKey)
  if (volumeId) await adjustExpected(database, volumeId, countDelta, bytesDelta)
}

export async function resolveVolumeId(
  database: Database,
  albumId: string,
  volumeKey: string
): Promise<string | null> {
  const keyed = volumeIdFromSourceKey(volumeKey)
  if (keyed) return keyed
  if (volumeKey !== 'buffer') return null
  const first = await database
    .select({ id: volume.id })
    .from(volume)
    .where(bufferVolumes(albumId))
    .orderBy(asc(volume.createdAt), asc(volume.id))
    .get()
  return first?.id ?? null
}
