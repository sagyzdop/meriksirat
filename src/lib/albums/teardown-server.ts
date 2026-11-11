import { eq, sql } from 'drizzle-orm'
import type { Database } from '@/db'
import { flamekeeper } from '@/db/schema'
import { batchDeleteCost } from '@/lib/cron/budget'
import type { Budget } from '@/lib/cron/budget'
import {
  DriveNotFoundError,
  FOLDERS_PER_LISTING,
  ID_SIZE_FIELDS,
  batchDeleteDriveFiles,
  listDriveFolderUpTo,
  listDriveFoldersUpTo,
} from '@/lib/google/google-drive'
import { loadListingSources, withListingOwnerToken } from './listing-server'
import {
  deleteAllowance,
  groupDeletesByOwner,
  planTeardown,
  settleTeardown,
} from './teardown'
import type {
  TeardownReading,
  TeardownSource,
  TeardownVerdict,
} from './teardown'
import { planListingBatches, splitBatchFiles } from './listing'
import type { ListingSource } from './listing'

const MIN_LIST_BUDGET = 2

const toTeardownFiles = (files: { id: string; size?: string | null }[]) =>
  files.map((f) => ({ id: f.id, bytes: Number(f.size ?? 0) || 0 }))

// Listing stops once half the budget is gone, so every pass keeps room to
// delete what it found and the next pass starts from less.
function mayList(budget: Budget): boolean {
  return (
    budget.canAfford(MIN_LIST_BUDGET) && budget.remaining() >= budget.total / 2
  )
}

async function readSource(
  database: Database,
  source: ListingSource,
  budget: Budget
): Promise<TeardownReading> {
  if (!source.listable) return { kind: 'unreachable' }
  if (!mayList(budget)) return { kind: 'skipped' }
  budget.spend(1)
  try {
    const result = await withListingOwnerToken(
      database,
      source.owner,
      (token) =>
        listDriveFolderUpTo(
          token,
          source.folderId,
          () => budget.take(1),
          ID_SIZE_FIELDS
        ),
      budget
    )
    return {
      kind: 'listed',
      complete: result.complete,
      files: toTeardownFiles(result.files),
    }
  } catch (error) {
    if (error instanceof DriveNotFoundError) return { kind: 'gone' }
    console.warn(`Could not list ${source.key} (${source.folderId}):`, error)
    return { kind: 'failed' }
  }
}

async function readBatch(
  database: Database,
  batch: ListingSource[],
  budget: Budget
): Promise<Record<string, TeardownReading>> {
  const each = (reading: TeardownReading) =>
    Object.fromEntries(batch.map((source) => [source.key, reading]))
  if (!mayList(budget)) return each({ kind: 'skipped' })
  budget.spend(1)
  try {
    const result = await withListingOwnerToken(
      database,
      batch[0].owner,
      (token) =>
        listDriveFoldersUpTo(
          token,
          batch.map((source) => source.folderId),
          () => budget.take(1),
          ID_SIZE_FIELDS
        ),
      budget
    )
    const split = splitBatchFiles(batch, result.files)
    return Object.fromEntries(
      batch.map((source) => [
        source.key,
        {
          kind: 'listed',
          complete: result.complete,
          files: toTeardownFiles(split[source.key]),
        },
      ])
    )
  } catch (error) {
    console.warn(`Could not list ${batch.length} volumes together:`, error)
    return each({ kind: 'failed' })
  }
}

async function releaseFlamekeeperBytes(
  database: Database,
  userId: string,
  bytes: number
): Promise<void> {
  if (bytes <= 0) return
  await database
    .update(flamekeeper)
    .set({
      usedBytes: sql`MAX(${flamekeeper.usedBytes} - ${bytes}, 0)`,
      driveUsageBytes: sql`MAX(${flamekeeper.driveUsageBytes} - ${bytes}, 0)`,
    })
    .where(eq(flamekeeper.userId, userId))
}

/**
 * One pass at emptying an album's volumes. Lists every volume fresh with its
 * own owner token (never the cached listing), deletes what it found, and says
 * 'finished' only when every listing was complete and every delete worked.
 * Needs no stored progress: what is left in Drive is the progress.
 */
export async function tearDownAlbumFiles(
  database: Database,
  row: { id: string; driveFolderId: string },
  budget: Budget
): Promise<TeardownVerdict> {
  const { cleanDroppedVolumes } = await import('./storage-server')
  await cleanDroppedVolumes(database, budget, {
    albumId: row.id,
    minAgeMs: 0,
  })
  const sources = (await loadListingSources(database, row)).filter(
    (s) => s.key !== 'master'
  )
  const listable = sources.filter((s) => s.listable)
  const readingByKey: Record<string, TeardownReading> = {}
  for (const batch of planListingBatches(listable, FOLDERS_PER_LISTING)) {
    Object.assign(
      readingByKey,
      batch.length === 1
        ? { [batch[0].key]: await readSource(database, batch[0], budget) }
        : await readBatch(database, batch, budget)
    )
  }
  const readings: TeardownSource[] = sources.map((source) => ({
    key: source.key,
    owner: source.owner,
    reading: readingByKey[source.key] ?? { kind: 'unreachable' },
  }))

  const plan = planTeardown(readings, deleteAllowance(budget.remaining()))
  const results: Record<string, { failed: number; threw?: boolean }> = {}
  for (const group of groupDeletesByOwner(plan.deletes)) {
    const ids = group.flatMap((del) => del.files.map((f) => f.id))
    budget.spend(batchDeleteCost(ids.length))
    try {
      const failedIds = new Set(
        await withListingOwnerToken(
          database,
          group[0].owner,
          (token) => batchDeleteDriveFiles(token, ids),
          budget
        )
      )
      for (const del of group) {
        const failed = del.files.filter((f) => failedIds.has(f.id))
        results[del.key] = { failed: failed.length }
        if (del.owner.kind === 'flamekeeper') {
          const freed = del.files
            .filter((f) => !failedIds.has(f.id))
            .reduce((sum, f) => sum + f.bytes, 0)
          await releaseFlamekeeperBytes(database, del.owner.userId, freed)
        }
      }
    } catch (error) {
      console.warn(`Could not delete files of ${group[0].key}:`, error)
      for (const del of group) {
        results[del.key] = { failed: del.files.length, threw: true }
      }
    }
  }
  if (plan.abandoned.length > 0) {
    console.warn(
      `Album ${row.id} leaves files with unreachable owners: ${plan.abandoned.join(', ')}`
    )
  }
  return settleTeardown(plan, results)
}
