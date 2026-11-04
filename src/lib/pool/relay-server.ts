import { and, eq, sql } from 'drizzle-orm'
import type { Database } from '@/db'
import { album, flamekeeper, photo, uploadReservation } from '@/db/schema'
import {
  DriveNotFoundError,
  deleteDriveFile,
  getDriveFileMeta,
} from '@/lib/google/google-drive'
import {
  getFlamekeeperAccessToken,
  withFlamekeeperToken,
} from '@/lib/flamekeeper/tokens'
import type { DrainStatus, RelayHandout } from '@/lib/flamekeeper/types'
import { OUT_OF_SPACE_MESSAGE } from './placement'
import { invalidateCachedListing } from '@/lib/albums/server'
import { releaseOwnedBytes, startFlamekeeperUpload } from './server'
import { loadVolumeFolderId } from './volumes-server'
import { isInVolumeFolder } from './volumes'

import {
  finishDrainIfEmpty,
  finishedDrainStatus,
  invalidateAlbumDetailIfCached,
  loadVolumePhotos,
  releaseEmptyVolumes,
  toStatus,
} from './drain-server'

const RELAY_CANDIDATES = 20

export async function startRelay(
  database: Database,
  sourceUserId: string,
  origin: string | undefined
): Promise<RelayHandout> {
  const row = await finishDrainIfEmpty(database, sourceUserId)
  if (!row) throw new Error('Not a flamekeeper')
  if (row.state !== 'draining') return { kind: 'done', status: toStatus(row) }

  const candidates = await loadVolumePhotos(
    database,
    sourceUserId,
    RELAY_CANDIDATES
  )
  if (candidates.length === 0) {
    return { kind: 'done', status: toStatus(row) }
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)]

  const albumRow = await database
    .select({ id: album.id, driveFolderId: album.driveFolderId })
    .from(album)
    .where(eq(album.id, pick.albumId))
    .get()
  if (!albumRow) throw new Error('Album not found')

  const sourceToken = await getFlamekeeperAccessToken(database, sourceUserId)
  let session: { uploadUrl: string; reservationId: string }
  try {
    session = await startFlamekeeperUpload(
      database,
      albumRow,
      {
        name: pick.name,
        mimeType: pick.mimeType,
        bytes: pick.bytes,
        origin,
      },
      { exclude: [sourceUserId] }
    )
  } catch (error) {
    if (error instanceof Error && error.message === OUT_OF_SPACE_MESSAGE) {
      return {
        kind: 'no_space',
        message:
          'No other flamekeeper has room for these photos right now. Try again once more flamekeepers join.',
      }
    }
    throw error
  }

  return {
    kind: 'photo',
    photoId: pick.id,
    albumId: pick.albumId,
    sourceFileId: pick.driveFileId,
    name: pick.name,
    mimeType: pick.mimeType,
    bytes: pick.bytes,
    sourceToken,
    uploadUrl: session.uploadUrl,
    reservationId: session.reservationId,
  }
}

async function discardRelayCopy(
  database: Database,
  destUserId: string,
  fileId: string,
  reservationId: string
): Promise<void> {
  try {
    await withFlamekeeperToken(database, destUserId, (token) =>
      deleteDriveFile(token, fileId)
    )
  } catch (error) {
    console.warn('Failed to delete unused relay copy:', error)
  }
  await database
    .delete(uploadReservation)
    .where(eq(uploadReservation.id, reservationId))
}

export async function confirmRelay(
  database: Database,
  sourceUserId: string,
  input: { photoId: string; reservationId: string; fileId: string }
): Promise<DrainStatus> {
  const reservation = await database
    .select()
    .from(uploadReservation)
    .where(eq(uploadReservation.id, input.reservationId))
    .get()
  if (!reservation) throw new Error('Move session expired, try again')
  const destUserId = reservation.flamekeeperUserId
  if (destUserId === sourceUserId) throw new Error('Invalid move session')

  const albumRow = await database
    .select({ id: album.id, driveFolderId: album.driveFolderId })
    .from(album)
    .where(eq(album.id, reservation.albumId))
    .get()
  if (!albumRow) throw new Error('Album not found')

  const copy = await withFlamekeeperToken(database, destUserId, (token) =>
    getDriveFileMeta(token, input.fileId)
  )
  const destFolderId = await loadVolumeFolderId(
    database,
    albumRow.id,
    destUserId
  )
  if (!isInVolumeFolder(copy, destFolderId)) {
    throw new Error('Moved copy not found in the album folder')
  }

  const original = await database
    .select({
      id: photo.id,
      albumId: photo.albumId,
      driveFileId: photo.driveFileId,
      bytes: photo.bytes,
      flamekeeperUserId: photo.flamekeeperUserId,
      state: photo.state,
    })
    .from(photo)
    .where(eq(photo.id, input.photoId))
    .get()

  const copyBytes = Number(copy.size ?? 0) || 0
  const stale =
    !original ||
    original.albumId !== albumRow.id ||
    original.flamekeeperUserId !== sourceUserId ||
    original.state !== 'live'
  const incomplete =
    !!original && original.bytes > 0 && copyBytes !== original.bytes

  if (stale || incomplete) {
    await discardRelayCopy(database, destUserId, input.fileId, reservation.id)
    if (incomplete) throw new Error('The moved copy was incomplete, try again')
    return await finishedDrainStatus(database, sourceUserId)
  }

  const bytes = original.bytes || copyBytes
  const claimed = await database
    .update(photo)
    .set({ driveFileId: input.fileId, flamekeeperUserId: destUserId })
    .where(
      and(
        eq(photo.id, original.id),
        eq(photo.driveFileId, original.driveFileId),
        eq(photo.flamekeeperUserId, sourceUserId)
      )
    )
  if ((claimed.meta?.changes ?? 0) === 0) {
    await discardRelayCopy(database, destUserId, input.fileId, reservation.id)
    return await finishedDrainStatus(database, sourceUserId)
  }
  await database.batch([
    database
      .update(flamekeeper)
      .set({
        usedBytes: sql`${flamekeeper.usedBytes} + ${bytes}`,
        driveUsageBytes: sql`${flamekeeper.driveUsageBytes} + ${bytes}`,
      })
      .where(eq(flamekeeper.userId, destUserId)),
    database
      .delete(uploadReservation)
      .where(eq(uploadReservation.id, reservation.id)),
    database
      .update(album)
      .set({ coverFileId: input.fileId })
      .where(
        and(
          eq(album.id, albumRow.id),
          eq(album.coverFileId, original.driveFileId)
        )
      ),
  ])

  try {
    await withFlamekeeperToken(database, sourceUserId, (token) =>
      deleteDriveFile(token, original.driveFileId)
    )
  } catch (error) {
    if (!(error instanceof DriveNotFoundError)) {
      console.warn(
        `Moved photo ${original.id}, but its old file stays in the source Drive:`,
        error
      )
    }
  }
  await releaseOwnedBytes(database, [
    {
      id: original.id,
      driveFileId: original.driveFileId,
      bytes,
      flamekeeperUserId: sourceUserId,
    },
  ])
  await releaseEmptyVolumes(database, sourceUserId, [albumRow.id])
  await invalidateCachedListing(albumRow.driveFolderId)
  await invalidateAlbumDetailIfCached(albumRow.id)

  return await finishedDrainStatus(database, sourceUserId)
}
