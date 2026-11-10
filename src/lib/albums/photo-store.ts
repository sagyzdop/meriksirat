import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, type Database } from '@/db'
import { album, photo, photoSource } from '@/db/schema'
import { isBufferSourceKey } from './listing'
import type { AlbumListingEntry, ListingFile } from './listing'
import {
  buildListingEntry,
  chunkFiles,
  isEmptySavePlan,
  planListingSave,
} from './photo-rows'

// One statement takes its rows as a single JSON parameter, which D1 caps at
// 2 MB. A listed file is well under 1 KB.
const INSERT_CHUNK = 500

async function workerDatabase(): Promise<Database> {
  const { env } = await import('cloudflare:workers')
  return db(env.meriksirat_d1 as D1Database)
}

export async function loadListingEntry(
  database: Database,
  albumId: string
): Promise<AlbumListingEntry | null> {
  const [albums, sources, photos] = await database.batch([
    database
      .select({ folderState: album.folderState })
      .from(album)
      .where(eq(album.id, albumId)),
    database
      .select({
        key: photoSource.key,
        folderId: photoSource.folderId,
        stamp: photoSource.stamp,
        status: photoSource.status,
        listedAt: photoSource.listedAt,
        failedAt: photoSource.failedAt,
      })
      .from(photoSource)
      .where(eq(photoSource.albumId, albumId)),
    database
      .select({ sourceKey: photo.sourceKey, meta: photo.meta })
      .from(photo)
      .where(eq(photo.albumId, albumId))
      .orderBy(sql`rowid`),
  ])
  return buildListingEntry(albums[0]?.folderState ?? 'ok', sources, photos)
}

function insertFiles(
  database: Database,
  albumId: string,
  sourceKey: string,
  files: ListingFile[]
) {
  return database
    .insert(photo)
    .select(
      sql`
        SELECT
          ${albumId},
          ${sourceKey},
          json_extract(value, '$.id'),
          CAST(COALESCE(json_extract(value, '$.size'), 0) AS INTEGER),
          json_extract(value, '$.md5Checksum'),
          value
        FROM json_each(${JSON.stringify(files)})
        WHERE true
      `
    )
    .onConflictDoUpdate({
      target: [photo.albumId, photo.sourceKey, photo.fileId],
      set: {
        size: sql`excluded.size`,
        md5: sql`excluded.md5`,
        meta: sql`excluded.meta`,
      },
    })
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
  if (plan.dropSources.length > 0) {
    statements.push(
      database
        .delete(photo)
        .where(
          and(
            eq(photo.albumId, albumId),
            inArray(photo.sourceKey, plan.dropSources)
          )
        ),
      database
        .delete(photoSource)
        .where(
          and(
            eq(photoSource.albumId, albumId),
            inArray(photoSource.key, plan.dropSources)
          )
        )
    )
  }
  for (const source of plan.putSources) {
    const { key, ...values } = source
    statements.push(
      database
        .insert(photoSource)
        .values({ albumId, key, ...values })
        .onConflictDoUpdate({
          target: [photoSource.albumId, photoSource.key],
          set: values,
        })
    )
  }
  for (const { key, files } of plan.replaceFiles) {
    statements.push(
      database
        .delete(photo)
        .where(and(eq(photo.albumId, albumId), eq(photo.sourceKey, key)))
    )
    for (const chunk of chunkFiles(files, INSERT_CHUNK)) {
      statements.push(insertFiles(database, albumId, key, chunk))
    }
  }
  await database.batch(statements as [(typeof statements)[number]])
}

/** Record a photo the app just placed, ahead of the next listing. */
export async function addPhotoRow(
  database: Database,
  albumId: string,
  sourceKey: string,
  file: ListingFile
): Promise<void> {
  await insertFiles(database, albumId, sourceKey, [file])
}

export async function removePhotoRow(
  database: Database,
  albumId: string,
  fileId: string
): Promise<void> {
  await database
    .delete(photo)
    .where(and(eq(photo.albumId, albumId), eq(photo.fileId, fileId)))
}

export async function hasBufferPhotoRow(
  database: Database,
  albumId: string,
  fileId: string
): Promise<boolean> {
  const rows = await database
    .select({ sourceKey: photo.sourceKey })
    .from(photo)
    .where(and(eq(photo.albumId, albumId), eq(photo.fileId, fileId)))
  return rows.some((row) => isBufferSourceKey(row.sourceKey))
}

/**
 * Drop an album's photo rows so the next view lists Drive again. Call after a
 * move, which gives every photo a new Drive file.
 */
export async function forgetAlbumListing(
  albumId: string,
  database?: Database
): Promise<void> {
  try {
    const store = database ?? (await workerDatabase())
    await store.batch([
      store.delete(photo).where(eq(photo.albumId, albumId)),
      store.delete(photoSource).where(eq(photoSource.albumId, albumId)),
    ])
  } catch (error) {
    console.warn(`Could not forget the photo rows of album ${albumId}:`, error)
  }
}
