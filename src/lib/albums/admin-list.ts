import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Database } from '@/db'
import { album, albumMember, flamekeeper, user, volume } from '@/db/schema'
import { buildPagination } from '@/lib/pagination'
import { chunk } from '@/lib/utils'
import { albumStatus, albumStorageHolder } from './status'
import type { AlbumStatus } from './status'
import type { TombstoneReason } from './tombstone'
import type {
  AdminAlbumListFilters,
  AdminAlbumListResponse,
  AdminAlbumRow,
  AlbumStorage,
} from './types'

const liveVolume = (extra?: SQL) =>
  sql`exists (select 1 from ${volume} where ${volume.albumId} = ${album.id} and ${volume.droppedAt} is null${extra ? sql` and ${extra}` : sql``})`

const LOST_TOMBSTONES: TombstoneReason[] = [
  'flamekeeper_lost',
  'flamekeeper_left',
  'folder_deleted',
]

function statusCondition(statuses: AlbumStatus[]): SQL {
  const lost = and(
    isNotNull(album.deletedAt),
    inArray(album.tombstoneReason, LOST_TOMBSTONES)
  )!
  const live = isNull(album.deletedAt)
  const open = and(
    live,
    isNull(album.scheduledDeletionAt),
    isNull(album.rescuedAt)
  )!
  const unhealthy = liveVolume(
    sql`exists (select 1 from ${flamekeeper} where ${flamekeeper.userId} = ${volume.flamekeeperUserId} and (${flamekeeper.state} = 'lost' or ${flamekeeper.lostSince} is not null))`
  )
  const parts: Record<AlbumStatus, SQL> = {
    lost,
    deleted: and(isNotNull(album.deletedAt), sql`not ${lost}`)!,
    scheduled_deletion: and(live, isNotNull(album.scheduledDeletionAt))!,
    rescued: and(
      live,
      isNull(album.scheduledDeletionAt),
      isNotNull(album.rescuedAt)
    )!,
    unhealthy: and(open, unhealthy)!,
    healthy: and(open, sql`not ${unhealthy}`)!,
  }
  const selected = new Set(statuses)
  const conditions: SQL[] = []
  const take = (group: AlbumStatus[], whole: SQL) => {
    if (!group.every((s) => selected.has(s))) return
    conditions.push(whole)
    for (const s of group) selected.delete(s)
  }
  take(['healthy', 'unhealthy', 'rescued', 'scheduled_deletion'], live)
  take(['healthy', 'unhealthy'], open)
  take(['lost', 'deleted'], isNotNull(album.deletedAt))
  for (const s of selected) conditions.push(parts[s])
  return or(...conditions)!
}

function filterConditions(
  filters: AdminAlbumListFilters,
  scopeUserId?: string
): SQL[] {
  const conditions: SQL[] = filters.status?.length
    ? [statusCondition(filters.status)]
    : [isNull(album.deletedAt)]

  if (scopeUserId) {
    const memberAlbums = sql`(select ${albumMember.albumId} from ${albumMember} where ${albumMember.userId} = ${scopeUserId})`
    conditions.push(
      or(
        eq(album.ownerUserId, scopeUserId),
        sql`${album.id} in ${memberAlbums}`
      )!
    )
  }

  const search = (filters.search ?? '').trim().toLowerCase()
  if (search) {
    const pattern = `%${search}%`
    conditions.push(
      or(
        like(sql`lower(${album.title})`, pattern),
        like(sql`lower(${album.description})`, pattern),
        like(sql`lower(${user.name})`, pattern),
        like(sql`lower(${user.email})`, pattern)
      )!
    )
  }

  if (filters.storage?.length) {
    const onFlamekeeper = liveVolume(isNotNull(volume.flamekeeperUserId))
    const parts: SQL[] = []
    if (filters.storage.includes('flamekeeper')) parts.push(onFlamekeeper)
    if (filters.storage.includes('buffer')) {
      parts.push(and(liveVolume(), sql`not ${onFlamekeeper}`)!)
    }
    if (parts.length) conditions.push(or(...parts)!)
  }

  if (filters.startDate) {
    conditions.push(
      gte(album.eventDate, new Date(`${filters.startDate}T00:00:00.000Z`))
    )
  }
  if (filters.endDate) {
    conditions.push(
      lte(album.eventDate, new Date(`${filters.endDate}T23:59:59.999Z`))
    )
  }

  return conditions
}

const sortColumns = {
  title: album.title,
  eventDate: album.eventDate,
  createdAt: album.createdAt,
  photoCount: album.photoCount,
  photoBytes: album.photoBytes,
}

export async function listAdminAlbums(
  database: Database,
  filters: AdminAlbumListFilters,
  scopeUserId?: string
): Promise<AdminAlbumListResponse> {
  const where = and(...filterConditions(filters, scopeUserId))
  const dir = filters.sortOrder === 'asc' ? asc : desc
  const offset = (filters.page - 1) * filters.limit

  const [countRow, rows] = await Promise.all([
    database
      .select({ total: sql<number>`count(*)` })
      .from(album)
      .leftJoin(user, eq(user.id, album.ownerUserId))
      .where(where)
      .get(),
    database
      .select({
        id: album.id,
        title: album.title,
        description: album.description,
        event: album.event,
        eventDate: album.eventDate,
        ownerUserId: album.ownerUserId,
        ownerName: user.name,
        ownerEmail: user.email,
        photoCount: album.photoCount,
        photoBytes: album.photoBytes,
        createdAt: album.createdAt,
        rescuedAt: album.rescuedAt,
        scheduledDeletionAt: album.scheduledDeletionAt,
        deletedAt: album.deletedAt,
        tombstoneReason: album.tombstoneReason,
      })
      .from(album)
      .leftJoin(user, eq(user.id, album.ownerUserId))
      .where(where)
      .orderBy(dir(sortColumns[filters.sortBy]), asc(album.id))
      .limit(filters.limit)
      .offset(offset)
      .all(),
  ])

  const volumeRows = (
    await Promise.all(
      chunk(
        rows.map((r) => r.id),
        50
      ).map((ids) =>
        database
          .select({
            albumId: volume.albumId,
            flamekeeperUserId: volume.flamekeeperUserId,
            droppedAt: volume.droppedAt,
            name: user.name,
            flamekeeperState: flamekeeper.state,
            flamekeeperLostSince: flamekeeper.lostSince,
          })
          .from(volume)
          .leftJoin(user, eq(user.id, volume.flamekeeperUserId))
          .leftJoin(
            flamekeeper,
            eq(flamekeeper.userId, volume.flamekeeperUserId)
          )
          .where(inArray(volume.albumId, ids))
          .all()
      )
    )
  ).flat()

  const albums: AdminAlbumRow[] = rows.map((row) => {
    const own = volumeRows.filter((v) => v.albumId === row.id)
    const holder = albumStorageHolder(own)
    const held = own.find((v) => !v.droppedAt && v.flamekeeperUserId)
    const storage: AlbumStorage = {
      holder,
      flamekeeperUserId:
        holder === 'flamekeeper' ? held!.flamekeeperUserId : null,
      flamekeeperName: holder === 'flamekeeper' ? (held!.name ?? null) : null,
    }
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? '',
      event: row.event ?? '',
      eventDate: row.eventDate.toISOString(),
      ownerUserId: row.ownerUserId,
      ownerName: row.ownerName ?? null,
      ownerEmail: row.ownerEmail ?? null,
      photoCount: row.photoCount,
      photoBytes: row.photoBytes,
      createdAt: row.createdAt.toISOString(),
      rescuedAt: row.rescuedAt ? row.rescuedAt.toISOString() : null,
      scheduledDeletionAt: row.scheduledDeletionAt
        ? row.scheduledDeletionAt.toISOString()
        : null,
      status: albumStatus({ ...row, volumes: own }),
      storage,
    }
  })

  return {
    albums,
    pagination: buildPagination(
      Number(countRow?.total ?? 0),
      filters.page,
      filters.limit
    ),
  }
}
