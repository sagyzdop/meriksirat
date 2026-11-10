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
import { addListedFiles, listedBufferFileIds } from '@/lib/albums/listing-store'
import { newId } from '@/lib/albums/ids'
import { nextVolumeNumber } from '@/lib/albums/volume-number'
import { hasOffloadPending } from '@/lib/albums/offload-pending'
import {
  bufferSourceKey,
  volumeIdFromSourceKey,
  type ListingFile,
} from '@/lib/albums/listing'
import { pickVolumeWithRoom } from '@/lib/albums/volume-limit'
import type { UploadSession } from '@/lib/albums/types'
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
import { UserError, userMessage } from '@/lib/user-error'

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
        throw new UserError('Could not set up the album storage, try again')
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

type UploadFile = { name: string; mimeType: string; bytes: number }

/**
 * Starts the uploads of several files of one album. The buffer checks run once
 * for the whole batch; each file gets its own upload address or error.
 */
export async function startBufferUploads(
  database: Database,
  albumRow: { id: string; driveFolderId: string },
  files: UploadFile[],
  origin?: string
): Promise<(UploadSession | { error: string })[]> {
  const plan = await getBufferPlan(database)
  if (plan.kind === 'unavailable') {
    console.warn(
      `Buffer is not configured, missing: ${plan.missing.join(', ')}`
    )
    throw new UserError(plan.message)
  }

  const blocked = bufferUploadBlock(
    await getBufferOverview(UPLOAD_USAGE_MAX_AGE_MS)
  )
  if (blocked) throw new UserError(blocked)
  const moving = await albumUploadBlock(database, albumRow.id)
  if (moving) throw new UserError(moving)

  const pendingBytes = new Map<string, number>()
  const results: (UploadSession | { error: string })[] = []
  for (const file of files) {
    try {
      const { volumeId, uploadUrl } = await mintBufferUpload(
        database,
        albumRow,
        plan,
        file,
        pendingBytes,
        origin
      )
      pendingBytes.set(volumeId, (pendingBytes.get(volumeId) ?? 0) + file.bytes)
      results.push({ uploadUrl })
    } catch (error) {
      results.push({
        error: userMessage(error, 'Upload failed'),
      })
    }
  }
  if (plan.grantId && results.some((result) => 'uploadUrl' in result)) {
    await clearState(plan.grantId, 'missing').catch(() => {})
  }
  return results
}

async function mintBufferUpload(
  database: Database,
  albumRow: { id: string; driveFolderId: string },
  plan: { email: string; grantId: string | null },
  file: UploadFile,
  pendingBytes: Map<string, number>,
  origin?: string
): Promise<{ volumeId: string; uploadUrl: string }> {
  let retried = false
  let currentVolumeId: string | null = null
  while (true) {
    try {
      const { volumeId, folderId } = await withGoogleToken((token) =>
        ensureBufferVolume(
          database,
          token,
          albumRow,
          plan,
          file.bytes,
          pendingBytes
        )
      )
      currentVolumeId = volumeId
      const uploadUrl = await withBufferToken(
        (token) =>
          mintResumableUpload(token, {
            name: file.name,
            folderId,
            mimeType: file.mimeType,
            size: file.bytes,
            origin,
          }),
        undefined,
        plan.grantId
      )
      return { volumeId, uploadUrl }
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
        throw new UserError(
          'The album storage folder could not be found in Google Drive, so uploads are paused.'
        )
      }
      const message = bufferUploadMessage(error)
      if (message) {
        console.warn('Buffer upload could not start:', error)
        throw new UserError(message)
      }
      throw error
    }
  }
}

/**
 * Registers several uploaded files of one album. Each file is checked in Drive
 * on its own; the stored listing is then checked and extended, and the volume
 * and album totals raised, once for the whole batch.
 */
export async function confirmBufferUploads(
  database: Database,
  albumRow: { id: string; driveFolderId: string },
  fileIds: string[]
): Promise<({ added: boolean } | { error: string })[]> {
  const volumeRows = await database
    .select({ id: volume.id, driveFolderId: volume.driveFolderId })
    .from(volume)
    .where(bufferVolumes(albumRow.id))
    .all()

  const checked = await Promise.all(
    fileIds.map(
      async (
        fileId
      ): Promise<{ file: CheckedBufferFile | null } | { error: string }> => {
        try {
          return { file: await checkBufferFile(volumeRows, fileId) }
        } catch (error) {
          console.warn(`Could not confirm upload ${fileId}:`, error)
          return { error: userMessage(error, 'Upload not confirmed') }
        }
      }
    )
  )

  const images = checked.flatMap((c) => ('file' in c && c.file ? [c.file] : []))
  const listed = await listedBufferFileIds(
    database,
    albumRow.id,
    images.map((image) => image.listed.id)
  )
  const fresh = new Map<string, CheckedBufferFile>()
  for (const image of images) {
    if (!listed.has(image.listed.id)) fresh.set(image.listed.id, image)
  }

  const added = new Map<string, { count: number; bytes: number }>()
  const byVolume = new Map<string, ListingFile[]>()
  for (const image of fresh.values()) {
    const total = added.get(image.volumeId) ?? { count: 0, bytes: 0 }
    added.set(image.volumeId, {
      count: total.count + 1,
      bytes: total.bytes + image.bytes,
    })
    byVolume.set(image.volumeId, [
      ...(byVolume.get(image.volumeId) ?? []),
      image.listed,
    ])
  }
  for (const [volumeId, files] of byVolume) {
    await addListedFiles(
      database,
      albumRow.id,
      bufferSourceKey(volumeId),
      files
    )
  }

  const results = checked.map((c) =>
    'error' in c
      ? { error: c.error }
      : { added: !!c.file && fresh.get(c.file.listed.id) === c.file }
  )

  if (added.size > 0) {
    let count = 0
    let bytes = 0
    for (const [volumeId, total] of added) {
      await adjustExpected(database, volumeId, total.count, total.bytes)
      count += total.count
      bytes += total.bytes
    }
    await database
      .update(album)
      .set({
        photoCount: sql`${album.photoCount} + ${count}`,
        photoBytes: sql`${album.photoBytes} + ${bytes}`,
      })
      .where(eq(album.id, albumRow.id))
  }
  return results
}

interface CheckedBufferFile {
  volumeId: string
  bytes: number
  listed: ListingFile
}

async function checkBufferFile(
  volumeRows: { id: string; driveFolderId: string | null }[],
  fileId: string
): Promise<CheckedBufferFile | null> {
  const file = await withBufferToken((token) => getDriveFileMeta(token, fileId))
  const target = volumeRows.find((v) => isInVolumeFolder(file, v.driveFolderId))
  if (!target) {
    throw new UserError('Uploaded file not found in the album folder')
  }

  if (!isImage(file)) {
    await withBufferToken((token) => deleteDriveFile(token, fileId))
    return null
  }

  const { parents: _parents, trashed: _trashed, ...listed } = file
  return { volumeId: target.id, bytes: Number(file.size ?? 0) || 0, listed }
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
  volumeKey: string,
  countDelta: number,
  bytesDelta: number
): Promise<void> {
  const volumeId = volumeIdFromSourceKey(volumeKey)
  if (volumeId) await adjustExpected(database, volumeId, countDelta, bytesDelta)
}
