import { and, eq, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import { db, type Database } from '@/db'
import { album, bufferGrant, volume } from '@/db/schema'
import { createBudget, type Budget } from '@/lib/cron/budget'
import { newId } from '@/lib/albums/ids'
import { nextVolumeNumber } from '@/lib/albums/volume-number'
import { albumMoveInProgress } from '@/lib/albums/offload-pending'
import {
  copyFilesInto,
  deleteFiles,
  listIdentities,
  shareFolderWith,
} from '@/lib/albums/storage-drive'
import { matchVolumeCopies, type OffloadCopy } from '@/lib/albums/storage-plan'
import { afterMove, recordRemaps } from '@/lib/albums/storage-server'
import { createDriveFolder, shareWithWriter } from '@/lib/google/google-drive'
import { withGoogleToken } from '@/lib/google/google-calendar-auth'
import { volumeFolderName } from '@/lib/pool/volumes'
import {
  bufferSwitchTarget,
  ENV_GRANT_ID,
  forgetBufferGrantRows,
  retireBufferGrants,
  type SwitchTarget,
} from './grant'
import { RETIRE_WINDOW_MS, reusableVolumeIds } from './grant-rules'
import { getBufferAccessToken } from './tokens'

const ALBUMS_PER_RUN = 25
const ALBUM_MIN_BUDGET = 8

export interface SwitchProgress {
  total: number
  remaining: number
}

function remainingFilter(target: SwitchTarget) {
  return and(
    isNull(volume.droppedAt),
    target.from
      ? inArray(volume.bufferGrantId, target.from)
      : or(isNull(volume.bufferGrantId), ne(volume.bufferGrantId, target.key))
  )
}

export async function getSwitchProgress(
  database: Database,
  target?: SwitchTarget | null
): Promise<SwitchProgress | null> {
  const current =
    target === undefined ? await bufferSwitchTarget(database) : target
  if (!current) return null
  const left = await database
    .select({ n: sql<number>`count(DISTINCT ${volume.albumId})` })
    .from(volume)
    .where(remainingFilter(current))
    .get()
  const remaining = left?.n ?? 0
  if (current.from) return { total: remaining, remaining }
  const done = await database
    .select({ n: sql<number>`count(DISTINCT ${volume.albumId})` })
    .from(volume)
    .where(and(isNull(volume.droppedAt), eq(volume.bufferGrantId, current.key)))
    .get()
  return { total: remaining + (done?.n ?? 0), remaining }
}

async function flip(database: Database, pendingId: string): Promise<void> {
  const active = await database
    .select({ id: bufferGrant.id })
    .from(bufferGrant)
    .where(eq(bufferGrant.status, 'active'))
    .get()
  const retireAfter = new Date(Date.now() + RETIRE_WINDOW_MS)
  await database.batch([
    ...(active
      ? [
          database
            .update(bufferGrant)
            .set({ status: 'retiring', retireAfter })
            .where(eq(bufferGrant.id, active.id)),
        ]
      : []),
    database
      .update(bufferGrant)
      .set({ status: 'active' })
      .where(eq(bufferGrant.id, pendingId)),
  ] as unknown as Parameters<typeof database.batch>[0])
  forgetBufferGrantRows()
}

interface SourceVolume {
  id: string
  number: number | null
  driveFolderId: string
  bufferGrantId: string | null
}

/**
 * A dropped volume on the target to finish instead of a new folder: the
 * original this source was copied from, or a copy an earlier run started.
 */
async function findReusable(
  database: Database,
  albumId: string,
  source: SourceVolume,
  target: SwitchTarget
): Promise<{ id: string; driveFolderId: string } | null> {
  const ids = reusableVolumeIds(
    { id: source.id, grantKey: source.bufferGrantId ?? ENV_GRANT_ID },
    target.key
  )
  const rows = await database
    .select({
      id: volume.id,
      driveFolderId: volume.driveFolderId,
      bufferGrantId: volume.bufferGrantId,
    })
    .from(volume)
    .where(
      and(
        eq(volume.albumId, albumId),
        inArray(volume.id, ids),
        isNotNull(volume.droppedAt),
        isNull(volume.flamekeeperUserId)
      )
    )
    .all()
  for (const id of ids) {
    const row = rows.find((r) => r.id === id)
    if (row?.driveFolderId && row.bufferGrantId === target.key) {
      return { id: row.id, driveFolderId: row.driveFolderId }
    }
  }
  return null
}

async function stageCopy(
  database: Database,
  albumRow: { id: string; driveFolderId: string },
  source: SourceVolume,
  target: SwitchTarget,
  token: string,
  budget: Budget
): Promise<{ stagedId: string; copies: OffloadCopy[]; bytes: number } | null> {
  let number = source.number
  if (number === null) {
    number = await nextVolumeNumber(database, albumRow.id)
    await database
      .update(volume)
      .set({ number })
      .where(eq(volume.id, source.id))
  }
  let staged = await findReusable(database, albumRow.id, source, target)
  if (staged && staged.id !== `${source.id}~${target.key}`) {
    const folderId = source.driveFolderId
    if (!budget.take(1)) return null
    await withGoogleToken(
      (master) => shareFolderWith(master, folderId, target.email, 'reader'),
      budget
    )
  }
  if (!staged) {
    if (!budget.take(4)) return null
    const created = await withGoogleToken(async (master) => {
      const folder = await createDriveFolder(
        master,
        volumeFolderName(number, newId(6)),
        albumRow.driveFolderId
      )
      const permissionId = await shareWithWriter(
        master,
        folder.id,
        target.email
      )
      await shareFolderWith(
        master,
        source.driveFolderId,
        target.email,
        'reader'
      )
      return { folderId: folder.id, permissionId }
    }, budget)
    const stagedId = `${source.id}~${target.key}`
    const values = {
      driveFolderId: created.folderId,
      permissionId: created.permissionId,
      bufferGrantId: target.key,
      droppedAt: new Date(),
      expectedCount: 0,
      expectedBytes: 0,
    }
    await database
      .insert(volume)
      .values({ id: stagedId, albumId: albumRow.id, ...values })
      .onConflictDoUpdate({ target: volume.id, set: values })
    staged = { id: stagedId, driveFolderId: created.folderId }
  }
  const stagedFolder = staged.driveFolderId
  const files = await listIdentities(token, source.driveFolderId, budget)
  const existing = matchVolumeCopies(
    files,
    await listIdentities(token, stagedFolder, budget)
  )
  // A reused folder can hold photos deleted from the album since it was copied.
  if (existing.extras.length > 0) {
    const failed = await deleteFiles(token, existing.extras, budget)
    if (failed.length > 0) return null
  }
  if (existing.missing.length > 0) {
    await copyFilesInto(token, existing.missing, stagedFolder, budget)
  }
  const listed = await listIdentities(token, stagedFolder, budget)
  const match = matchVolumeCopies(files, listed)
  if (match.missing.length > 0 || match.extras.length > 0) return null
  const latest = await listIdentities(token, source.driveFolderId, budget)
  if (matchVolumeCopies(latest, listed).missing.length > 0) return null
  return {
    stagedId: staged.id,
    copies: match.copies,
    bytes: match.copies.reduce((n, c) => n + c.size, 0),
  }
}

async function migrateAlbum(
  database: Database,
  albumRow: { id: string; driveFolderId: string },
  target: SwitchTarget,
  token: string,
  budget: Budget
): Promise<void> {
  const rows = await database
    .select({
      id: volume.id,
      number: volume.number,
      driveFolderId: volume.driveFolderId,
      bufferGrantId: volume.bufferGrantId,
      flamekeeperUserId: volume.flamekeeperUserId,
    })
    .from(volume)
    .where(and(eq(volume.albumId, albumRow.id), remainingFilter(target)))
    .all()

  for (const row of rows.filter((r) => r.flamekeeperUserId)) {
    if (row.driveFolderId) {
      const folderId = row.driveFolderId
      if (!budget.take(1)) return
      await withGoogleToken(
        (master) => shareFolderWith(master, folderId, target.email, 'reader'),
        budget
      )
    }
    await database
      .update(volume)
      .set({ bufferGrantId: target.liveId })
      .where(eq(volume.id, row.id))
  }

  const ready: {
    source: SourceVolume
    stagedId: string
    copies: OffloadCopy[]
    bytes: number
  }[] = []
  for (const row of rows.filter((r) => !r.flamekeeperUserId)) {
    if (!row.driveFolderId) {
      await database
        .update(volume)
        .set({ bufferGrantId: target.liveId })
        .where(eq(volume.id, row.id))
      continue
    }
    const source = { ...row, driveFolderId: row.driveFolderId }
    const staged = await stageCopy(
      database,
      albumRow,
      source,
      target,
      token,
      budget
    )
    if (!staged) return
    ready.push({ source, ...staged })
  }
  if (ready.length === 0) return

  await recordRemaps(
    database,
    albumRow.id,
    ready.flatMap((r) => r.copies)
  )
  const now = new Date()
  // Moving albums back off a retiring grant leaves nothing to roll back to.
  const dropAt = target.from ? now : new Date(now.getTime() + RETIRE_WINDOW_MS)
  await database.batch(
    ready.flatMap((r) => [
      database
        .update(volume)
        .set({
          droppedAt: dropAt,
          number: null,
          bufferGrantId: r.source.bufferGrantId ?? ENV_GRANT_ID,
        })
        .where(eq(volume.id, r.source.id)),
      database
        .update(volume)
        .set({
          droppedAt: null,
          number: r.source.number,
          bufferGrantId: target.liveId,
          expectedCount: r.copies.length,
          expectedBytes: r.bytes,
          expectedChangedAt: now,
        })
        .where(eq(volume.id, r.stagedId)),
    ]) as unknown as Parameters<typeof database.batch>[0]
  )
  await afterMove(albumRow.id, albumRow.driveFolderId)
}

/**
 * Copies every album's volumes to the switch target one album at a time,
 * finishing old copies still in the target account instead of starting over.
 * A switch makes the pending account active once nothing is left to copy;
 * originals are dropped with a delay and removed later with the old token.
 */
export async function runBufferSwitch(
  database: Database,
  budget: Budget = createBudget()
): Promise<SwitchProgress | null> {
  await retireBufferGrants(database)
  const target = await bufferSwitchTarget(database)
  if (!target) return null
  if (target.state !== 'ok') return getSwitchProgress(database, target)

  const albums = await database
    .selectDistinct({ id: album.id, driveFolderId: album.driveFolderId })
    .from(volume)
    .innerJoin(album, eq(album.id, volume.albumId))
    .where(remainingFilter(target))
    .limit(ALBUMS_PER_RUN)
    .all()

  if (albums.length === 0) {
    if (!target.from) await flip(database, target.key)
    return null
  }

  let token: string | null = null
  for (const albumRow of albums) {
    if (!budget.canAfford(ALBUM_MIN_BUDGET)) break
    try {
      if (await albumMoveInProgress(albumRow.id)) continue
      token ??= await getBufferAccessToken(target.key)
      await migrateAlbum(database, albumRow, target, token, budget)
    } catch (error) {
      console.warn(`Could not switch buffer for album ${albumRow.id}:`, error)
    }
  }
  return getSwitchProgress(database, target)
}

export async function runBufferSwitchStep(
  env: { meriksirat_d1: D1Database },
  budget: Budget
): Promise<void> {
  await runBufferSwitch(db(env.meriksirat_d1), budget)
}
