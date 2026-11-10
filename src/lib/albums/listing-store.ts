import { and, eq, inArray, like, sql } from 'drizzle-orm'
import { db, type Database } from '@/db'
import { album, albumListing } from '@/db/schema'
import type { AlbumListingEntry, ListingFile } from './listing'
import {
  buildListingEntry,
  isEmptySavePlan,
  planListingSave,
} from './listing-rows'

async function workerDatabase(): Promise<Database> {
  const { env } = await import('cloudflare:workers')
  return db(env.meriksirat_d1 as D1Database)
}

export async function loadListingEntry(
  database: Database,
  albumId: string
): Promise<AlbumListingEntry | null> {
  const [albums, rows] = await database.batch([
    database
      .select({ folderState: album.folderState })
      .from(album)
      .where(eq(album.id, albumId)),
    database
      .select({
        key: albumListing.key,
        folderId: albumListing.folderId,
        stamp: albumListing.stamp,
        status: albumListing.status,
        listedAt: albumListing.listedAt,
        failedAt: albumListing.failedAt,
        files: albumListing.files,
      })
      .from(albumListing)
      .where(eq(albumListing.albumId, albumId)),
  ])
  return buildListingEntry(albums[0]?.folderState ?? 'ok', rows)
}

export async function saveListingEntry(
  database: Database,
  albumId: string,
  previous: AlbumListingEntry | null,
  next: AlbumListingEntry
): Promise<void> {
  const plan = planListingSave(previous, next)
  if (isEmptySavePlan(plan)) return

  const statements = []
  if (plan.folderState) {
    statements.push(
      database
        .update(album)
        .set({
          folderState: plan.folderState,
          updatedAt: sql`${album.updatedAt}`,
        })
        .where(eq(album.id, albumId))
    )
  }
  if (plan.drop.length > 0) {
    statements.push(
      database
        .delete(albumListing)
        .where(
          and(
            eq(albumListing.albumId, albumId),
            inArray(albumListing.key, plan.drop)
          )
        )
    )
  }
  for (const { key, files, ...state } of plan.put) {
    const values = files === null ? state : { ...state, files }
    statements.push(
      database
        .insert(albumListing)
        .values({ albumId, key, ...values })
        .onConflictDoUpdate({
          target: [albumListing.albumId, albumListing.key],
          set: values,
        })
    )
  }
  await database.batch(statements as [(typeof statements)[number]])
}

const hasFile = (fileId: string) =>
  sql`EXISTS (SELECT 1 FROM json_each(${albumListing.files}) WHERE json_extract(value, '$.id') = ${fileId})`

/**
 * Add photos the app just placed to their folder's stored listing, ahead of
 * the next listing. One statement that skips files already there, so parallel
 * uploads cannot overwrite each other or list a file twice, and the stored
 * listing is scanned a fixed number of times whatever the batch size.
 * Nothing happens when the folder has never been listed; the next view lists it.
 */
export async function addListedFiles(
  database: Database,
  albumId: string,
  sourceKey: string,
  files: ListingFile[]
): Promise<void> {
  if (files.length === 0) return
  await database
    .update(albumListing)
    .set({
      files: sql`(SELECT json_group_array(json(v)) FROM (SELECT value AS v FROM json_each(${albumListing.files}) UNION ALL SELECT n.value FROM json_each(${JSON.stringify(files)}) AS n WHERE json_extract(n.value, '$.id') NOT IN (SELECT json_extract(value, '$.id') FROM json_each(${albumListing.files}))))`,
    })
    .where(
      and(eq(albumListing.albumId, albumId), eq(albumListing.key, sourceKey))
    )
}

export async function removeListedFile(
  database: Database,
  albumId: string,
  fileId: string
): Promise<void> {
  await database
    .update(albumListing)
    .set({
      files: sql`(SELECT json_group_array(json(value)) FROM json_each(${albumListing.files}) WHERE json_extract(value, '$.id') != ${fileId})`,
    })
    .where(and(eq(albumListing.albumId, albumId), hasFile(fileId)))
}

/**
 * Which of `fileIds` the album's stored buffer listings already hold, in one
 * pass over them.
 */
export async function listedBufferFileIds(
  database: Database,
  albumId: string,
  fileIds: string[]
): Promise<Set<string>> {
  if (fileIds.length === 0) return new Set()
  const rows = await database.all<{ id: string }>(
    sql`SELECT DISTINCT json_extract(f.value, '$.id') AS id FROM ${albumListing}, json_each(${albumListing.files}) AS f WHERE ${albumListing.albumId} = ${albumId} AND ${like(albumListing.key, 'buffer:%')} AND json_extract(f.value, '$.id') IN (${sql.join(
      fileIds.map((id) => sql`${id}`),
      sql`, `
    )})`
  )
  return new Set(rows.map((row) => row.id))
}

/**
 * The size and checksum of every stored file of the album whose size is one of
 * `sizes`. D1 scans the stored listings, so the Worker never parses them.
 */
export async function listedFilesOfSizes(
  database: Database,
  albumId: string,
  sizes: number[]
): Promise<{ size: string | null; md5Checksum: string | null }[]> {
  if (sizes.length === 0) return []
  return database.all(
    sql`SELECT json_extract(f.value, '$.size') AS size, json_extract(f.value, '$.md5Checksum') AS md5Checksum FROM ${albumListing}, json_each(${albumListing.files}) AS f WHERE ${albumListing.albumId} = ${albumId} AND CAST(json_extract(f.value, '$.size') AS INTEGER) IN (${sql.join(
      sizes.map((size) => sql`${size}`),
      sql`, `
    )})`
  )
}

/**
 * Drop an album's stored listings so the next view lists Drive again. Call
 * after a move, which gives every photo a new Drive file.
 */
export async function forgetAlbumListing(
  albumId: string,
  database?: Database
): Promise<void> {
  try {
    const store = database ?? (await workerDatabase())
    await store.delete(albumListing).where(eq(albumListing.albumId, albumId))
  } catch (error) {
    console.warn(`Could not forget the listing of album ${albumId}:`, error)
  }
}
