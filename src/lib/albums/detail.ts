import { and, eq, isNotNull } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { db } from '@/db'
import { album, albumMember, photo, user } from '@/db/schema'
import { getGoogleAccessToken } from '@/lib/google/google-calendar-auth'
import {
  DriveNotFoundError,
  getDriveFolderState,
  listDriveFolderFiles,
} from '@/lib/google/google-drive'
import type { DriveFileMeta } from '@/lib/google/google-drive'
import {
  driveFileToAlbumPhoto,
  isImage,
  photoRowToAlbumPhoto,
  sortPhotosByCapture,
} from './photo-backfill'
import { requestAlbumIndex } from './photo-index'
import { getCachedListing, setCachedListing } from './server'
import type {
  AlbumAccessLevel,
  AlbumAuthor,
  AlbumDetail,
  AlbumFolderState,
  AlbumPhoto,
} from './types'
import { albumCoverUrl } from './urls'

type Database = ReturnType<typeof db>
export type AlbumRecord = typeof album.$inferSelect

interface Listing {
  photos: AlbumPhoto[]
  folderState: AlbumFolderState
}

function livePhotoRows(database: Database, albumId: string, extra?: SQL) {
  return database
    .select()
    .from(photo)
    .where(and(eq(photo.albumId, albumId), eq(photo.state, 'live'), extra))
    .all()
}

async function listPhotosFromTable(
  database: Database,
  row: AlbumRecord
): Promise<Listing> {
  let folderState: AlbumFolderState
  const cached = await getCachedListing(row.driveFolderId)
  if (cached) {
    folderState = cached.folderState
  } else {
    folderState = await getDriveFolderState(
      await getGoogleAccessToken(),
      row.driveFolderId
    )
    await setCachedListing(row.driveFolderId, [], folderState)
  }

  if (folderState === 'missing') return { photos: [], folderState }

  const rows = await livePhotoRows(database, row.id)
  return {
    photos: sortPhotosByCapture(rows.map(photoRowToAlbumPhoto)),
    folderState,
  }
}

async function listPhotosFromDrive(
  database: Database,
  row: AlbumRecord
): Promise<Listing> {
  await requestAlbumIndex(database, row.id)

  const cached = await getCachedListing(row.driveFolderId)

  let files: DriveFileMeta[]
  let folderState: AlbumFolderState

  if (cached) {
    files = cached.files
    folderState = cached.folderState
  } else {
    try {
      const accessToken = await getGoogleAccessToken()
      const [state, listed] = await Promise.all([
        getDriveFolderState(accessToken, row.driveFolderId),
        listDriveFolderFiles(accessToken, row.driveFolderId),
      ])
      folderState = state
      files = listed
      await setCachedListing(row.driveFolderId, files, folderState)
    } catch (error) {
      if (!(error instanceof DriveNotFoundError)) throw error
      folderState = 'missing'
      files = []
      await setCachedListing(row.driveFolderId, files, folderState)
    }
  }

  const photos = files.filter(isImage).map(driveFileToAlbumPhoto)

  if (folderState !== 'missing') {
    const seen = new Set(photos.map((p) => p.id))
    const owned = await livePhotoRows(
      database,
      row.id,
      isNotNull(photo.flamekeeperUserId)
    )
    for (const r of owned) {
      if (!seen.has(r.driveFileId)) photos.push(photoRowToAlbumPhoto(r))
    }
  }

  return { photos: sortPhotosByCapture(photos), folderState }
}

function listAlbumPhotos(
  database: Database,
  row: AlbumRecord
): Promise<Listing> {
  return row.photosIndexedAt
    ? listPhotosFromTable(database, row)
    : listPhotosFromDrive(database, row)
}

function defaultCoverFileId(photos: AlbumPhoto[]): string | null {
  let earliest: AlbumPhoto | null = null
  for (const photo of photos) {
    const createdAt = photo.createdAt
    if (!createdAt) continue
    if (!earliest || createdAt < (earliest.createdAt ?? 0)) earliest = photo
  }
  return earliest?.id ?? null
}

export async function buildAlbumCore(
  database: Database,
  row: AlbumRecord
): Promise<Record<string, unknown>> {
  const [listing, owner, members] = await Promise.all([
    listAlbumPhotos(database, row),
    database
      .select({ name: user.name, telegramUsername: user.telegramUsername })
      .from(user)
      .where(eq(user.id, row.ownerUserId))
      .get(),
    database
      .select({
        userId: albumMember.userId,
        name: user.name,
        telegramUsername: user.telegramUsername,
      })
      .from(albumMember)
      .innerJoin(user, eq(albumMember.userId, user.id))
      .where(eq(albumMember.albumId, row.id))
      .all(),
  ])

  const coverFileId = row.coverFileId ?? defaultCoverFileId(listing.photos)
  if (row.coverFileId !== coverFileId && coverFileId) {
    await database
      .update(album)
      .set({ coverFileId, updatedAt: new Date() })
      .where(eq(album.id, row.id))
  }

  const authors: AlbumAuthor[] = [
    {
      id: row.ownerUserId,
      name: owner?.name ?? 'Unknown',
      telegramUsername: owner?.telegramUsername ?? null,
    },
    ...members.map((m) => ({
      id: m.userId,
      name: m.name,
      telegramUsername: m.telegramUsername,
    })),
  ]

  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    title: row.title,
    description: row.description ?? '',
    event: row.event ?? '',
    eventDate: row.eventDate ? row.eventDate.toISOString() : null,
    driveFolderId: row.driveFolderId,
    coverFileId,
    coverUrl: coverFileId ? albumCoverUrl(coverFileId) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    coAuthorCount: members.length,
    authors,
    photos: listing.photos,
    folderState: listing.folderState,
  }
}

export function decorateAlbumDetail(
  core: Record<string, unknown>,
  row: Pick<AlbumRecord, 'editShareToken' | 'expiresAt' | 'pinned'>,
  access: AlbumAccessLevel,
  currentUser: { id: string } | null
): AlbumDetail {
  const ownership =
    currentUser && core.ownerUserId === currentUser.id ? 'owner' : 'co-author'
  return {
    ...(core as unknown as Omit<
      AlbumDetail,
      'ownership' | 'access' | 'editShareToken'
    >),
    ownership,
    access,
    editShareToken: access !== 'none' ? row.editShareToken : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    pinned: !!row.pinned,
    tombstone: null,
  }
}

export function buildTombstoneDetail(row: AlbumRecord): AlbumDetail {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    title: row.title,
    description: '',
    event: row.event ?? '',
    eventDate: row.eventDate ? row.eventDate.toISOString() : null,
    driveFolderId: '',
    coverFileId: null,
    coverUrl: null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ownership: 'co-author',
    coAuthorCount: 0,
    authors: [],
    photos: [],
    access: 'none',
    editShareToken: null,
    folderState: 'ok',
    expiresAt: null,
    pinned: false,
    tombstone: {
      reason: row.tombstoneReason ?? 'expired',
      deletedAt: (row.deletedAt ?? row.updatedAt).toISOString(),
    },
  }
}
