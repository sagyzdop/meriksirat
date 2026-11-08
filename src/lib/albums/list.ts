import {
  and,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  like,
  lt,
  or,
  sql,
} from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Database } from '@/db'
import { album, albumMember, user } from '@/db/schema'
import { chunk } from '@/lib/utils'
import type {
  AlbumAuthor,
  AlbumListPage,
  AlbumListQuery,
  AlbumSummary,
} from './types'
import { albumCoverUrl } from './urls'

type Ownership = 'owner' | 'co-author'

type AlbumRowWithAuthors = typeof album.$inferSelect & {
  owner: AlbumAuthor | null
  members: { user: AlbumAuthor | null }[]
}

function encodeAlbumCursor(createdAtMs: number, id: string): string {
  const raw = `${createdAtMs}:${id}`
  return typeof btoa === 'function'
    ? btoa(raw)
    : Buffer.from(raw, 'utf-8').toString('base64')
}

function decodeAlbumCursor(
  cursor: string | null | undefined
): { createdAtMs: number; id: string } | null {
  if (!cursor) return null
  try {
    const raw =
      typeof atob === 'function'
        ? atob(cursor)
        : Buffer.from(cursor, 'base64').toString('utf-8')
    const sep = raw.indexOf(':')
    const createdAtMs = Number(raw.slice(0, sep))
    const id = raw.slice(sep + 1)
    if (!Number.isFinite(createdAtMs) || !id) return null
    return { createdAtMs, id }
  } catch {
    return null
  }
}

function toAlbumSummary(
  row: AlbumRowWithAuthors,
  me: string | null,
  ownershipOverride?: Ownership
): AlbumSummary {
  const authors: AlbumAuthor[] = [
    ...(row.owner
      ? [
          {
            id: row.owner.id,
            name: row.owner.name,
            telegramUsername: row.owner.telegramUsername,
          },
        ]
      : []),
    ...(row.members ?? [])
      .map((m) =>
        m.user
          ? {
              id: m.user.id,
              name: m.user.name,
              telegramUsername: m.user.telegramUsername,
            }
          : null
      )
      .filter((a): a is AlbumAuthor => !!a),
  ]
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    title: row.title,
    description: row.description ?? '',
    event: row.event ?? '',
    eventDate: row.eventDate.toISOString(),
    driveFolderId: row.driveFolderId,
    coverFileId: row.coverFileId,
    coverUrl: row.coverFileId ? albumCoverUrl(row.coverFileId) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ownership:
      ownershipOverride ??
      (me && row.ownerUserId === me ? 'owner' : 'co-author'),
    coAuthorCount: (row.members ?? []).length,
    authors,
    heartCount: row.heartCount,
  }
}

interface ListAlbumsArgs {
  database: Database
  baseWhere?: SQL
  ownershipWhere?: (ownership: Ownership) => SQL | undefined
  me?: string | null
  ownershipOverride?: Ownership
  query: AlbumListQuery
}

export async function listAlbumsPaginated({
  database,
  baseWhere,
  ownershipWhere,
  me = null,
  ownershipOverride,
  query,
}: ListAlbumsArgs): Promise<AlbumListPage> {
  const conditions: SQL[] = [isNull(album.deletedAt)]
  if (baseWhere) conditions.push(baseWhere)

  const search = (query.search ?? '').trim()
  if (search) {
    const pattern = `%${search.toLowerCase()}%`
    conditions.push(
      or(
        like(sql`lower(${album.title})`, pattern),
        like(sql`lower(${album.description})`, pattern)
      )!
    )
  }

  if (query.ownership?.length && ownershipWhere) {
    const own = query.ownership
      .map((o) => ownershipWhere(o))
      .filter((c): c is NonNullable<typeof c> => !!c)
    if (own.length === 1) conditions.push(own[0])
    else if (own.length > 1) conditions.push(or(...own)!)
  }

  const decoded = decodeAlbumCursor(query.cursor)
  if (decoded) {
    conditions.push(
      or(
        lt(album.createdAt, new Date(decoded.createdAtMs)),
        and(
          eq(album.createdAt, new Date(decoded.createdAtMs)),
          lt(album.id, decoded.id)
        )!
      )!
    )
  }

  const where = conditions.length ? and(...conditions) : undefined
  const limit = query.limit ?? 24

  const albumRows = await database
    .select({
      ...getTableColumns(album),
      ownerId: user.id,
      ownerName: user.name,
      ownerTelegramUsername: user.telegramUsername,
    })
    .from(album)
    .leftJoin(user, eq(album.ownerUserId, user.id))
    .where(where)
    .orderBy(desc(album.createdAt), desc(album.id))
    .limit(limit + 1)
    .all()

  // A page can carry limit + 1 (up to 101) ids and D1 caps bound parameters
  // at 100/query, so the ids are sent in chunks of 100.
  const albumIds = albumRows.map((r) => r.id)
  const memberRows = (
    await Promise.all(
      chunk(albumIds, 100).map((idPart) =>
        database
          .select({
            albumId: albumMember.albumId,
            userId: user.id,
            userName: user.name,
            userTelegramUsername: user.telegramUsername,
          })
          .from(albumMember)
          .innerJoin(user, eq(albumMember.userId, user.id))
          .where(inArray(albumMember.albumId, idPart))
          .all()
      )
    )
  ).flat()

  const membersByAlbum = new Map<string, typeof memberRows>()
  for (const m of memberRows) {
    const list = membersByAlbum.get(m.albumId) || []
    list.push(m)
    membersByAlbum.set(m.albumId, list)
  }

  const rows = albumRows.map((r) => ({
    ...r,
    owner: r.ownerId
      ? {
          id: r.ownerId,
          name: r.ownerName,
          telegramUsername: r.ownerTelegramUsername,
        }
      : null,
    members: (membersByAlbum.get(r.id) || []).map((m) => ({
      user: m.userId
        ? {
            id: m.userId,
            name: m.userName,
            telegramUsername: m.userTelegramUsername,
          }
        : null,
    })),
  }))

  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows
  const last = pageRows[pageRows.length - 1]

  return {
    albums: pageRows.map((row) =>
      toAlbumSummary(row as AlbumRowWithAuthors, me, ownershipOverride)
    ),
    nextCursor:
      hasMore && last
        ? encodeAlbumCursor(last.createdAt.getTime(), last.id)
        : null,
  }
}
