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
 * Add a photo the app just placed to its folder's stored listing, ahead of the
 * next listing. One statement, so parallel uploads cannot overwrite each other.
 * Nothing happens when the folder has never been listed; the next view lists it.
 */
export async function addListedFile(
  database: Database,
  albumId: string,
  sourceKey: string,
  file: ListingFile
): Promise<void> {
  await database
    .update(albumListing)
    .set({
      files: sql`json_insert(${albumListing.files}, '$[#]', json(${JSON.stringify(file)}))`,
    })
    .where(
      and(
        eq(albumListing.albumId, albumId),
        eq(albumListing.key, sourceKey),
        sql`NOT ${hasFile(file.id)}`
      )
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

export async function isListedInBuffer(
  database: Database,
  albumId: string,
  fileId: string
): Promise<boolean> {
  const rows = await database
    .select({ key: albumListing.key })
    .from(albumListing)
    .where(
      and(
        eq(albumListing.albumId, albumId),
        like(albumListing.key, 'buffer:%'),
        hasFile(fileId)
      )
    )
  return rows.length > 0
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
