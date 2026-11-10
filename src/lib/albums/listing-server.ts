import { and, asc, eq, or, ne } from 'drizzle-orm'
import type { Database } from '@/db'
import { album, flamekeeper, flamekeeperGrant, volume } from '@/db/schema'
import { withBufferToken } from '@/lib/buffer/tokens'
import { createBudget } from '@/lib/cron/budget'
import type { Budget } from '@/lib/cron/budget'
import { withFlamekeeperToken } from '@/lib/flamekeeper/tokens'
import { withGoogleToken } from '@/lib/google/google-calendar-auth'
import {
  getDriveFolderState,
  listDriveFolderUpTo,
} from '@/lib/google/google-drive'
import type { DriveFolderState } from '@/lib/google/google-drive'
import {
  LISTING_DRIVE_BUDGET,
  applyListingOutcomes,
  classifyListingError,
  findListedFile,
  listingTotals,
  planListingRefresh,
  planListingSources,
  readAlbumListing,
} from './listing'
import type {
  AlbumListing,
  ListingFile,
  ListingOutcome,
  ListingOwner,
  ListingSource,
} from './listing'
import { loadListingEntry, saveListingEntry } from './photo-store'

export function withListingOwnerToken<T>(
  database: Database,
  owner: ListingOwner,
  run: (token: string) => Promise<T>,
  budget?: Budget
): Promise<T> {
  switch (owner.kind) {
    case 'master':
      return withGoogleToken(run, budget)
    case 'buffer':
      return withBufferToken(run, budget, owner.grantId)
    case 'flamekeeper':
      return withFlamekeeperToken(database, owner.userId, run, budget)
  }
}

export async function loadListingSources(
  database: Database,
  row: { id: string; driveFolderId: string }
): Promise<ListingSource[]> {
  const rows = await database
    .select({
      id: volume.id,
      userId: volume.flamekeeperUserId,
      driveFolderId: volume.driveFolderId,
      droppedAt: volume.droppedAt,
      expectedCount: volume.expectedCount,
      expectedBytes: volume.expectedBytes,
      expectedChangedAt: volume.expectedChangedAt,
      state: flamekeeper.state,
      grantUserId: flamekeeperGrant.userId,
    })
    .from(volume)
    .leftJoin(flamekeeper, eq(flamekeeper.userId, volume.flamekeeperUserId))
    .leftJoin(
      flamekeeperGrant,
      eq(flamekeeperGrant.userId, volume.flamekeeperUserId)
    )
    .where(eq(volume.albumId, row.id))
    .orderBy(asc(volume.createdAt), asc(volume.id))
    .all()
  const buffers = rows.filter((v) => v.userId === null && !v.droppedAt)
  return planListingSources({
    albumFolderId: row.driveFolderId,
    bufferVolumes: buffers.map((v) => ({
      id: v.id,
      driveFolderId: v.driveFolderId,
      expectedCount: v.expectedCount,
      expectedBytes: v.expectedBytes,
      expectedChangedAt: v.expectedChangedAt?.getTime() ?? null,
    })),
    flamekeeperVolumes: rows.flatMap((v) =>
      v.userId === null
        ? []
        : [
            {
              id: v.id,
              userId: v.userId,
              driveFolderId: v.driveFolderId,
              droppedAt: v.droppedAt,
              state: v.state,
              hasGrant: !!v.grantUserId,
              expectedCount: v.expectedCount,
              expectedBytes: v.expectedBytes,
              expectedChangedAt: v.expectedChangedAt?.getTime() ?? null,
            },
          ]
    ),
  })
}

async function listSource(
  database: Database,
  source: ListingSource,
  budget: Budget
): Promise<ListingOutcome> {
  if (!budget.canAfford(2)) return { kind: 'skipped' }
  budget.spend(1)
  try {
    const result = await withListingOwnerToken(
      database,
      source.owner,
      (token) =>
        listDriveFolderUpTo(token, source.folderId, () => budget.take(1)),
      budget
    )
    return { kind: 'listed', ...result }
  } catch (error) {
    const kind = classifyListingError(error)
    console.warn(`Could not list ${source.key} (${source.folderId}):`, error)
    return { kind }
  }
}

async function checkFolderState(
  folderId: string,
  budget: Budget
): Promise<DriveFolderState | null> {
  budget.spend(2)
  try {
    return await withGoogleToken(
      (token) => getDriveFolderState(token, folderId),
      budget
    )
  } catch (error) {
    console.warn(`Could not check album folder ${folderId}:`, error)
    return null
  }
}

export async function loadAlbumListing(
  database: Database,
  row: { id: string; driveFolderId: string },
  options: { force?: boolean; strictStamp?: boolean; budget?: Budget } = {}
): Promise<AlbumListing> {
  const [sources, entry] = await Promise.all([
    loadListingSources(database, row),
    loadListingEntry(database, row.id),
  ])
  const now = Date.now()
  const plan = planListingRefresh({
    sources,
    entry,
    now,
    force: options.force,
    strictStamp: options.strictStamp,
  })
  if (entry && !plan.checkFolder) {
    return readAlbumListing({ entry, sources, now })
  }

  const budget = options.budget ?? createBudget(LISTING_DRIVE_BUDGET)
  const folderState = await checkFolderState(row.driveFolderId, budget)
  const due = sources.filter((s) => plan.actions[s.key] === 'list')

  const outcomes: Record<string, ListingOutcome> = {}
  if (folderState === 'trashed') {
    for (const source of due) outcomes[source.key] = { kind: 'failed' }
  } else if (folderState !== 'missing') {
    await Promise.all(
      due.map(async (source) => {
        outcomes[source.key] = await listSource(database, source, budget)
      })
    )
  }

  const next = applyListingOutcomes({
    sources,
    entry,
    now,
    folderState,
    outcomes,
  })
  try {
    await saveListingEntry(database, row.id, entry, next)
  } catch (error) {
    console.warn(`Could not store the photo rows of album ${row.id}:`, error)
  }
  const listing = readAlbumListing({ entry: next, sources, now })
  await syncAlbumTotals(database, row.id, listing)
  return listing
}

async function syncAlbumTotals(
  database: Database,
  albumId: string,
  listing: AlbumListing
): Promise<void> {
  const totals = listingTotals(listing)
  if (!totals) return
  try {
    await database
      .update(album)
      .set({ photoCount: totals.count, photoBytes: totals.bytes })
      .where(
        and(
          eq(album.id, albumId),
          or(
            ne(album.photoCount, totals.count),
            ne(album.photoBytes, totals.bytes)
          )
        )
      )
  } catch (error) {
    console.warn(`Could not store the photo totals of album ${albumId}:`, error)
  }
}

/**
 * Authorizes an action on one file of an album. A file counts only when a
 * listing of this album's own folders (each read with its owner's token) shows
 * it, so a client cannot aim a privileged token at any other Drive file. When
 * the stored photos miss the file, Drive is listed once before giving up.
 */
export async function findAlbumFile(
  database: Database,
  row: { id: string; driveFolderId: string },
  fileId: string
): Promise<{
  owner: ListingOwner
  file: ListingFile
  volumeKey: string
} | null> {
  const cached = findListedFile(await loadAlbumListing(database, row), fileId)
  if (cached) return cached
  return findListedFile(
    await loadAlbumListing(database, row, { force: true }),
    fileId
  )
}
