import { eq, sql } from 'drizzle-orm'
import type { Database } from '@/db'
import { flamekeeper } from '@/db/schema'
import { batchDeleteCost } from '@/lib/cron/budget'
import type { Budget } from '@/lib/cron/budget'
import {
  DriveNotFoundError,
  batchDeleteDriveFiles,
  listDriveFolderUpTo,
} from '@/lib/google/google-drive'
import { loadListingSources, withListingOwnerToken } from './listing-server'
import { deleteAllowance, planTeardown, settleTeardown } from './teardown'
import type {
  TeardownReading,
  TeardownSource,
  TeardownVerdict,
} from './teardown'
import type { ListingSource } from './listing'

const MIN_LIST_BUDGET = 2

async function readSource(
  database: Database,
  source: ListingSource,
  budget: Budget
): Promise<TeardownReading> {
  if (!source.listable) return { kind: 'unreachable' }
  if (!budget.canAfford(MIN_LIST_BUDGET)) return { kind: 'skipped' }
  budget.spend(1)
  try {
    const result = await withListingOwnerToken(
      database,
      source.owner,
      (token) =>
        listDriveFolderUpTo(token, source.folderId, () => budget.take(1)),
      budget
    )
    return {
      kind: 'listed',
      complete: result.complete,
      files: result.files.map((f) => ({
        id: f.id,
        bytes: Number(f.size ?? 0) || 0,
      })),
    }
  } catch (error) {
    if (error instanceof DriveNotFoundError) return { kind: 'gone' }
    console.warn(`Could not list ${source.key} (${source.folderId}):`, error)
    return { kind: 'failed' }
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
  const sources = (await loadListingSources(database, row)).filter(
    (s) => s.key !== 'master'
  )
  const readings: TeardownSource[] = []
  for (const source of sources) {
    readings.push({
      key: source.key,
      owner: source.owner,
      reading: await readSource(database, source, budget),
    })
  }

  const plan = planTeardown(readings, deleteAllowance(budget.remaining()))
  const results: Record<string, { failed: number; threw?: boolean }> = {}
  for (const del of plan.deletes) {
    const ids = del.files.map((f) => f.id)
    budget.spend(batchDeleteCost(ids.length))
    try {
      const failedIds = new Set(
        await withListingOwnerToken(
          database,
          del.owner,
          (token) => batchDeleteDriveFiles(token, ids),
          budget
        )
      )
      results[del.key] = { failed: failedIds.size }
      if (del.owner.kind === 'flamekeeper') {
        const freed = del.files
          .filter((f) => !failedIds.has(f.id))
          .reduce((sum, f) => sum + f.bytes, 0)
        await releaseFlamekeeperBytes(database, del.owner.userId, freed)
      }
    } catch (error) {
      console.warn(`Could not delete files of ${del.key}:`, error)
      results[del.key] = { failed: ids.length, threw: true }
    }
  }
  if (plan.abandoned.length > 0) {
    console.warn(
      `Album ${row.id} leaves files with unreachable owners: ${plan.abandoned.join(', ')}`
    )
  }
  return settleTeardown(plan, results)
}
