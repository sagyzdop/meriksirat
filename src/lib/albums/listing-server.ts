import { eq } from 'drizzle-orm'
import type { Database } from '@/db'
import {
  bufferVolume,
  flamekeeper,
  flamekeeperGrant,
  volume,
} from '@/db/schema'
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
  findListedFileOwner,
  planListingRefresh,
  planListingSources,
  readAlbumListing,
} from './listing'
import type {
  AlbumListing,
  ListingOutcome,
  ListingOwner,
  ListingSource,
} from './listing'
import { getCachedListing, setCachedListing } from './server'

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
      return withBufferToken(run, budget)
    case 'flamekeeper':
      return withFlamekeeperToken(database, owner.userId, run, budget)
  }
}

async function loadListingSources(
  database: Database,
  row: { id: string; driveFolderId: string }
): Promise<ListingSource[]> {
  const [buffer, volumes] = await Promise.all([
    database
      .select({
        driveFolderId: bufferVolume.driveFolderId,
        expectedCount: bufferVolume.expectedCount,
        expectedBytes: bufferVolume.expectedBytes,
      })
      .from(bufferVolume)
      .where(eq(bufferVolume.albumId, row.id))
      .get(),
    database
      .select({
        userId: volume.flamekeeperUserId,
        driveFolderId: volume.driveFolderId,
        droppedAt: volume.droppedAt,
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
      .all(),
  ])
  return planListingSources({
    albumFolderId: row.driveFolderId,
    bufferVolume: buffer ?? null,
    flamekeeperVolumes: volumes.map((v) => ({
      userId: v.userId,
      driveFolderId: v.driveFolderId,
      droppedAt: v.droppedAt,
      state: v.state,
      hasGrant: !!v.grantUserId,
    })),
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
  options: { force?: boolean } = {}
): Promise<AlbumListing> {
  const [sources, entry] = await Promise.all([
    loadListingSources(database, row),
    getCachedListing(row.driveFolderId),
  ])
  const now = Date.now()
  const plan = planListingRefresh({
    sources,
    entry,
    now,
    force: options.force,
  })
  if (entry && !plan.checkFolder) {
    return readAlbumListing({ entry, sources, now })
  }

  const budget = createBudget(LISTING_DRIVE_BUDGET)
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
  await setCachedListing(row.driveFolderId, next)
  return readAlbumListing({ entry: next, sources, now })
}

export async function findAlbumFileOwner(
  database: Database,
  row: { id: string; driveFolderId: string },
  fileId: string
): Promise<ListingOwner | null> {
  const listing = await loadAlbumListing(database, row)
  return findListedFileOwner(listing, fileId)
}
