import { eq } from 'drizzle-orm'
import type { Database } from '@/db'
import { album, albumMember, flamekeeper, user, volume } from '@/db/schema'
import { planCountWarning } from './count-warning'
import { listingBytes, listingPhotos } from './listing'
import type { ListingFile } from './listing'
import { loadAlbumListing } from './listing-server'
import type {
  AlbumAccessLevel,
  AlbumAuthor,
  AlbumDetail,
  AlbumStorage,
} from './types'
import { invalidatePublicAlbumList } from './server'
import { albumStatus, albumStorageHolder } from './status'
import { albumCoverUrl } from './urls'

export type AlbumRecord = typeof album.$inferSelect

function defaultCoverFileId(files: ListingFile[]): string | null {
  let earliest: ListingFile | null = null
  for (const file of files) {
    if (!file.createdTime) continue
    if (!earliest || file.createdTime < (earliest.createdTime ?? '')) {
      earliest = file
    }
  }
  return earliest?.id ?? null
}

export async function buildAlbumCore(
  database: Database,
  row: AlbumRecord
): Promise<Record<string, unknown>> {
  const [owner, members] = await Promise.all([
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
    eventDate: row.eventDate.toISOString(),
    driveFolderId: row.driveFolderId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    coAuthorCount: members.length,
    authors,
  }
}

export async function loadAlbumDetail(
  database: Database,
  core: Record<string, unknown>,
  row: AlbumRecord,
  access: AlbumAccessLevel,
  currentUser: { id: string; role?: string } | null,
  options: { force?: boolean } = {}
): Promise<AlbumDetail> {
  const listing = await loadAlbumListing(database, row, options)
  const photos = listingPhotos(listing)

  const coverFileId = row.coverFileId ?? defaultCoverFileId(listing.files)
  if (!row.coverFileId && coverFileId && listing.complete) {
    await database
      .update(album)
      .set({ coverFileId, updatedAt: new Date() })
      .where(eq(album.id, row.id))
    await invalidatePublicAlbumList()
  }

  const volumes = await database
    .select({
      flamekeeperUserId: volume.flamekeeperUserId,
      droppedAt: volume.droppedAt,
      name: user.name,
      flamekeeperState: flamekeeper.state,
      flamekeeperLostSince: flamekeeper.lostSince,
    })
    .from(volume)
    .leftJoin(user, eq(user.id, volume.flamekeeperUserId))
    .leftJoin(flamekeeper, eq(flamekeeper.userId, volume.flamekeeperUserId))
    .where(eq(volume.albumId, row.id))
    .all()
  const holder = albumStorageHolder(volumes)
  const held = volumes.find((v) => !v.droppedAt && v.flamekeeperUserId)
  const storage: AlbumStorage = {
    holder,
    flamekeeperUserId:
      holder === 'flamekeeper' ? held!.flamekeeperUserId : null,
    flamekeeperName: holder === 'flamekeeper' ? (held!.name ?? null) : null,
  }

  const ownership =
    currentUser && core.ownerUserId === currentUser.id ? 'owner' : 'co-author'
  return {
    ...(core as unknown as Omit<
      AlbumDetail,
      | 'ownership'
      | 'access'
      | 'editShareToken'
      | 'photos'
      | 'photoBytes'
      | 'folderState'
      | 'coverFileId'
      | 'coverUrl'
      | 'countWarning'
    >),
    heartCount: row.heartCount,
    coverFileId,
    coverUrl: coverFileId ? albumCoverUrl(coverFileId) : null,
    photos,
    photoBytes: listingBytes(listing),
    folderState: listing.folderState,
    ownership,
    access,
    editShareToken: access !== 'none' ? row.editShareToken : null,
    rescuedAt: row.rescuedAt ? row.rescuedAt.toISOString() : null,
    scheduledDeletionAt: row.scheduledDeletionAt
      ? row.scheduledDeletionAt.toISOString()
      : null,
    status: albumStatus({ ...row, volumes }),
    storage,
    tombstone: null,
    countWarning: currentUser
      ? planCountWarning({
          listing,
          viewer: {
            isOwner: row.ownerUserId === currentUser.id,
            isAdmin: currentUser.role === 'admin',
          },
          now: Date.now(),
        })
      : null,
  }
}

export function buildTombstoneDetail(row: AlbumRecord): AlbumDetail {
  return {
    id: row.id,
    heartCount: row.heartCount,
    ownerUserId: row.ownerUserId,
    title: row.title,
    description: '',
    event: row.event ?? '',
    eventDate: row.eventDate.toISOString(),
    driveFolderId: '',
    coverFileId: null,
    coverUrl: null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ownership: 'co-author',
    coAuthorCount: 0,
    authors: [],
    photos: [],
    photoBytes: 0,
    access: 'none',
    editShareToken: null,
    folderState: 'ok',
    rescuedAt: null,
    scheduledDeletionAt: null,
    status: albumStatus(row),
    storage: { holder: 'none', flamekeeperUserId: null, flamekeeperName: null },
    tombstone: {
      reason: row.tombstoneReason!,
      deletedAt: (row.deletedAt ?? row.updatedAt).toISOString(),
    },
    countWarning: null,
  }
}
