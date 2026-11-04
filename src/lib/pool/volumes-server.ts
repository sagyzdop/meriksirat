import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import type { Database } from '@/db'
import { album, flamekeeperGrant, photo, volume } from '@/db/schema'
import { invalidateCachedListing } from '@/lib/albums/server'
import {
  batchDeleteDriveFiles,
  listDriveFolderFileIds,
} from '@/lib/google/google-drive'
import { withFlamekeeperToken } from '@/lib/flamekeeper/tokens'
import { takeIfBudgeted, type Budget } from '@/lib/cron/budget'
import {
  MAX_HEAL_DELETES,
  planHealDeletes,
  tallyHeals,
  type HealOutcome,
  type HealTally,
} from './volumes'

const HEAL_COST = 3
export const ALBUM_HEALS_PER_ATTEMPT = 4

export async function volumeHasPhotoRows(
  database: Database,
  albumId: string,
  userId: string
): Promise<boolean> {
  const row = await database
    .select({ id: photo.id })
    .from(photo)
    .where(
      and(
        eq(photo.albumId, albumId),
        eq(photo.flamekeeperUserId, userId),
        ne(photo.state, 'deleted')
      )
    )
    .limit(1)
    .get()
  return !!row
}

export interface HealResult {
  outcome: HealOutcome
  worked: boolean
}

export async function healBlockedVolume(
  database: Database,
  v: { albumId: string; flamekeeperUserId: string; driveFolderId: string },
  budget?: Budget
): Promise<HealResult> {
  const grant = await database
    .select({ userId: flamekeeperGrant.userId })
    .from(flamekeeperGrant)
    .where(eq(flamekeeperGrant.userId, v.flamekeeperUserId))
    .get()
  if (!grant) return { outcome: 'blocked', worked: false }
  if (!takeIfBudgeted(budget, HEAL_COST)) {
    return { outcome: 'incomplete', worked: false }
  }

  try {
    const listed = await withFlamekeeperToken(
      database,
      v.flamekeeperUserId,
      (token) =>
        listDriveFolderFileIds(token, v.driveFolderId, MAX_HEAL_DELETES),
      budget
    )
    if (listed.length === 0) return { outcome: 'cleared', worked: false }
    const referenced = await database
      .select({ driveFileId: photo.driveFileId })
      .from(photo)
      .where(
        and(inArray(photo.driveFileId, listed), ne(photo.state, 'deleted'))
      )
      .all()
    const doomed = planHealDeletes(
      listed,
      referenced.map((r) => r.driveFileId)
    )
    if (doomed.length === 0) return { outcome: 'blocked', worked: false }
    if (await volumeHasPhotoRows(database, v.albumId, v.flamekeeperUserId)) {
      return { outcome: 'blocked', worked: false }
    }
    await withFlamekeeperToken(
      database,
      v.flamekeeperUserId,
      (token) => batchDeleteDriveFiles(token, doomed),
      budget
    )
    const albumRow = await database
      .select({ driveFolderId: album.driveFolderId })
      .from(album)
      .where(eq(album.id, v.albumId))
      .get()
    if (albumRow) await invalidateCachedListing(albumRow.driveFolderId)
    return {
      outcome: listed.length >= MAX_HEAL_DELETES ? 'incomplete' : 'cleared',
      worked: true,
    }
  } catch (error) {
    console.warn(
      `Could not clear leftover files of ${v.flamekeeperUserId} in album ${v.albumId}:`,
      error
    )
    return { outcome: 'blocked', worked: false }
  }
}

export async function healAlbumVolumes(
  database: Database,
  albumId: string,
  _now: Date,
  budget?: Budget
): Promise<HealTally> {
  const rows = await database
    .select({
      albumId: volume.albumId,
      flamekeeperUserId: volume.flamekeeperUserId,
      driveFolderId: volume.driveFolderId,
    })
    .from(volume)
    .where(
      and(eq(volume.albumId, albumId), sql`${volume.driveFolderId} IS NOT NULL`)
    )
    .all()
  const outcomes: HealOutcome[] = []
  let worked = 0
  for (const v of rows) {
    if (worked >= ALBUM_HEALS_PER_ATTEMPT) {
      outcomes.push('incomplete')
      continue
    }
    const healed = await healBlockedVolume(
      database,
      { ...v, driveFolderId: v.driveFolderId! },
      budget
    )
    if (healed.worked) worked++
    outcomes.push(healed.outcome)
  }
  return tallyHeals(outcomes)
}
