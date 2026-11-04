import { and, eq, ne, sql } from 'drizzle-orm'
import type { Database } from '@/db'
import { bufferVolume, photo } from '@/db/schema'
import {
  DriveNotFoundError,
  createDriveFolder,
  deleteDriveFile,
  getDriveFileMeta,
  mintResumableUpload,
  shareWithWriter,
} from '@/lib/google/google-drive'
import { withGoogleToken } from '@/lib/google/google-calendar-auth'
import { isImage } from '@/lib/albums/photo-backfill'
import { registerDrivePhotos } from '@/lib/albums/photo-index'
import { newId } from '@/lib/albums/ids'
import { isInVolumeFolder, volumeFolderName } from '@/lib/pool/volumes'
import {
  BUFFER_OWNER_ID,
  bufferUploadMessage,
  decideMissingVolumeFolder,
  planBufferUpload,
  planVolumeSetup,
} from './plan'
import { withBufferToken } from './tokens'

const key = (albumId: string) => eq(bufferVolume.albumId, albumId)

export async function ensureBufferVolume(
  database: Database,
  masterToken: string,
  albumRow: { id: string; driveFolderId: string },
  bufferEmail: string
): Promise<string> {
  const load = () =>
    database
      .select({
        driveFolderId: bufferVolume.driveFolderId,
        permissionId: bufferVolume.permissionId,
      })
      .from(bufferVolume)
      .where(key(albumRow.id))
      .get()

  const existing = (await load()) ?? null
  const setup = planVolumeSetup(existing)
  if (!setup.create && !setup.share) return existing!.driveFolderId!

  let folderId = existing?.driveFolderId ?? null
  if (setup.create) {
    const created = await createDriveFolder(
      masterToken,
      volumeFolderName(newId(6)),
      albumRow.driveFolderId
    )
    const claimed = existing
      ? await database
          .update(bufferVolume)
          .set({ driveFolderId: created.id, permissionId: '' })
          .where(
            and(key(albumRow.id), sql`${bufferVolume.driveFolderId} IS NULL`)
          )
      : await database
          .insert(bufferVolume)
          .values({ albumId: albumRow.id, driveFolderId: created.id })
          .onConflictDoNothing()
    if ((claimed.meta?.changes ?? 0) > 0) {
      folderId = created.id
    } else {
      try {
        await deleteDriveFile(masterToken, created.id)
      } catch (error) {
        console.warn('Failed to delete a spare buffer volume folder:', error)
      }
      const winner = await load()
      if (!winner?.driveFolderId) {
        throw new Error('Could not set up the album storage, try again')
      }
      if (winner.permissionId) return winner.driveFolderId
      folderId = winner.driveFolderId
    }
  }

  const permissionId = await shareWithWriter(
    masterToken,
    folderId!,
    bufferEmail
  )
  await database
    .update(bufferVolume)
    .set({ permissionId })
    .where(key(albumRow.id))
  return folderId!
}

async function forgetBufferVolumeFolder(
  database: Database,
  albumId: string
): Promise<void> {
  await database
    .update(bufferVolume)
    .set({ driveFolderId: null, permissionId: '' })
    .where(key(albumId))
}

async function volumeHasPhotos(
  database: Database,
  albumId: string
): Promise<boolean> {
  const row = await database
    .select({ id: photo.id })
    .from(photo)
    .where(
      and(
        eq(photo.albumId, albumId),
        eq(photo.flamekeeperUserId, BUFFER_OWNER_ID),
        ne(photo.state, 'deleted')
      )
    )
    .limit(1)
    .get()
  return !!row
}

export async function startBufferUpload(
  database: Database,
  albumRow: { id: string; driveFolderId: string },
  file: { name: string; mimeType: string; bytes: number; origin?: string }
): Promise<{ uploadUrl: string }> {
  const plan = planBufferUpload(process.env)
  if (plan.kind === 'unavailable') {
    console.warn(
      `Buffer is not configured, missing: ${plan.missing.join(', ')}`
    )
    throw new Error(plan.message)
  }

  let retried = false
  while (true) {
    try {
      const folderId = await withGoogleToken((token) =>
        ensureBufferVolume(database, token, albumRow, plan.email)
      )
      const uploadUrl = await withBufferToken((token) =>
        mintResumableUpload(token, {
          name: file.name,
          folderId,
          mimeType: file.mimeType,
          size: file.bytes,
          origin: file.origin,
        })
      )
      return { uploadUrl }
    } catch (error) {
      if (error instanceof DriveNotFoundError) {
        const decision = decideMissingVolumeFolder({
          hasPhotos: await volumeHasPhotos(database, albumRow.id),
          retried,
        })
        if (decision === 'recreate') {
          await forgetBufferVolumeFolder(database, albumRow.id)
          retried = true
          continue
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
  const volumeRow = await database
    .select({ driveFolderId: bufferVolume.driveFolderId })
    .from(bufferVolume)
    .where(key(albumRow.id))
    .get()

  const file = await withBufferToken((token) => getDriveFileMeta(token, fileId))
  if (!isInVolumeFolder(file, volumeRow?.driveFolderId ?? null)) {
    throw new Error('Uploaded file not found in the album folder')
  }

  if (!isImage(file)) {
    await withBufferToken((token) => deleteDriveFile(token, fileId))
    return false
  }

  const inserted = await registerDrivePhotos(
    database,
    albumRow.id,
    [file],
    false,
    BUFFER_OWNER_ID
  )
  if (inserted > 0) {
    await adjustExpected(database, albumRow.id, 1, Number(file.size ?? 0) || 0)
  }
  return inserted > 0
}

export async function adjustExpected(
  database: Database,
  albumId: string,
  countDelta: number,
  bytesDelta: number
): Promise<void> {
  await database
    .update(bufferVolume)
    .set({
      expectedCount: sql`MAX(${bufferVolume.expectedCount} + ${countDelta}, 0)`,
      expectedBytes: sql`MAX(${bufferVolume.expectedBytes} + ${bytesDelta}, 0)`,
    })
    .where(key(albumId))
}
