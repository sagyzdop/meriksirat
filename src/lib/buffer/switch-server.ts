import { and, eq, isNull, ne, or, sql } from 'drizzle-orm'
import { db, type Database } from '@/db'
import { album, bufferGrant, volume } from '@/db/schema'
import { createBudget, type Budget } from '@/lib/cron/budget'
import { newId } from '@/lib/albums/ids'
import { nextVolumeNumber } from '@/lib/albums/volume-number'
import { albumMoveInProgress } from '@/lib/albums/offload-pending'
import {
  copyFilesInto,
  listIdentities,
  shareFolderWith,
} from '@/lib/albums/storage-drive'
import {
  matchFiles,
  matchVolumeCopies,
  type OffloadCopy,
} from '@/lib/albums/storage-plan'
import { afterMove, recordRemaps } from '@/lib/albums/storage-server'
import { createDriveFolder, shareWithWriter } from '@/lib/google/google-drive'
import { withGoogleToken } from '@/lib/google/google-calendar-auth'
import { volumeFolderName } from '@/lib/pool/volumes'
import {
  ENV_GRANT_ID,
  forgetBufferGrantRows,
  retireBufferGrants,
} from './grant'
import { RETIRE_WINDOW_MS } from './grant-rules'
import { getBufferAccessToken } from './tokens'

const ALBUMS_PER_RUN = 25
const ALBUM_MIN_BUDGET = 8

export interface SwitchProgress {
  total: number
  remaining: number
}

function remainingFilter(targetId: string) {
  return and(
    isNull(volume.droppedAt),
    or(isNull(volume.bufferGrantId), ne(volume.bufferGrantId, targetId))
  )
}

export async function getSwitchProgress(
  database: Database
): Promise<SwitchProgress | null> {
  const pending = await database
    .select({ id: bufferGrant.id })
    .from(bufferGrant)
    .where(eq(bufferGrant.status, 'pending'))
    .get()
  if (!pending) return null
  const [left, done] = await Promise.all([
    database
      .select({ n: sql<number>`count(DISTINCT ${volume.albumId})` })
      .from(volume)
      .where(remainingFilter(pending.id))
      .get(),
    database
      .select({ n: sql<number>`count(DISTINCT ${volume.albumId})` })
      .from(volume)
      .where(
        and(isNull(volume.droppedAt), eq(volume.bufferGrantId, pending.id))
      )
      .get(),
  ])
  const remaining = left?.n ?? 0
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

async function stageCopy(
  database: Database,
  albumRow: { id: string; driveFolderId: string },
  source: SourceVolume,
  pending: { id: string; email: string },
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
  const stagedId = `${source.id}~${pending.id}`
  let stagedFolder = (
    await database
      .select({ driveFolderId: volume.driveFolderId })
      .from(volume)
      .where(eq(volume.id, stagedId))
      .get()
  )?.driveFolderId
  if (!stagedFolder) {
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
        pending.email
      )
      await shareFolderWith(
        master,
        source.driveFolderId,
        pending.email,
        'reader'
      )
      return { folderId: folder.id, permissionId }
    }, budget)
    const values = {
      driveFolderId: created.folderId,
      permissionId: created.permissionId,
      bufferGrantId: pending.id,
      droppedAt: new Date(),
      expectedCount: 0,
      expectedBytes: 0,
    }
    await database
      .insert(volume)
      .values({ id: stagedId, albumId: albumRow.id, ...values })
      .onConflictDoUpdate({ target: volume.id, set: values })
    stagedFolder = created.folderId
  }
  const files = await listIdentities(token, source.driveFolderId, budget)
  const existing = await listIdentities(token, stagedFolder, budget)
  const toCopy = matchFiles(files, existing).missing
  if (toCopy.length > 0) {
    await copyFilesInto(token, toCopy, stagedFolder, budget)
  }
  const listed = await listIdentities(token, stagedFolder, budget)
  const match = matchVolumeCopies(files, listed)
  if (match.missing.length > 0 || match.extras.length > 0) return null
  const latest = await listIdentities(token, source.driveFolderId, budget)
  if (matchFiles(latest, listed).missing.length > 0) return null
  return {
    stagedId,
    copies: match.copies,
    bytes: match.copies.reduce((n, c) => n + c.size, 0),
  }
}

async function migrateAlbum(
  database: Database,
  albumRow: { id: string; driveFolderId: string },
  pending: { id: string; email: string },
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
    .where(and(eq(volume.albumId, albumRow.id), remainingFilter(pending.id)))
    .all()

  for (const row of rows.filter((r) => r.flamekeeperUserId)) {
    if (row.driveFolderId) {
      const folderId = row.driveFolderId
      if (!budget.take(1)) return
      await withGoogleToken(
        (master) => shareFolderWith(master, folderId, pending.email, 'reader'),
        budget
      )
    }
    await database
      .update(volume)
      .set({ bufferGrantId: pending.id })
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
        .set({ bufferGrantId: pending.id })
        .where(eq(volume.id, row.id))
      continue
    }
    const source = { ...row, driveFolderId: row.driveFolderId }
    const staged = await stageCopy(
      database,
      albumRow,
      source,
      pending,
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
  const keepUntil = new Date(now.getTime() + RETIRE_WINDOW_MS)
  await database.batch(
    ready.flatMap((r) => [
      database
        .update(volume)
        .set({
          droppedAt: keepUntil,
          number: null,
          bufferGrantId: r.source.bufferGrantId ?? ENV_GRANT_ID,
        })
        .where(eq(volume.id, r.source.id)),
      database
        .update(volume)
        .set({
          droppedAt: null,
          number: r.source.number,
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
 * Copies every album's volumes to the pending buffer account, one album at a
 * time, and makes it the active buffer once nothing is left to copy. Originals
 * are dropped with a delay and removed later with the old account's token.
 */
export async function runBufferSwitch(
  database: Database,
  budget: Budget = createBudget()
): Promise<SwitchProgress | null> {
  await retireBufferGrants(database)
  const pending = await database
    .select({
      id: bufferGrant.id,
      email: bufferGrant.email,
      state: bufferGrant.state,
    })
    .from(bufferGrant)
    .where(eq(bufferGrant.status, 'pending'))
    .get()
  if (!pending) return null
  if (pending.state !== 'ok') return getSwitchProgress(database)

  const albums = await database
    .selectDistinct({ id: album.id, driveFolderId: album.driveFolderId })
    .from(volume)
    .innerJoin(album, eq(album.id, volume.albumId))
    .where(remainingFilter(pending.id))
    .limit(ALBUMS_PER_RUN)
    .all()

  if (albums.length === 0) {
    await flip(database, pending.id)
    return null
  }

  let token: string | null = null
  for (const albumRow of albums) {
    if (!budget.canAfford(ALBUM_MIN_BUDGET)) break
    try {
      if (await albumMoveInProgress(albumRow.id)) continue
      token ??= await getBufferAccessToken(pending.id)
      await migrateAlbum(database, albumRow, pending, token, budget)
    } catch (error) {
      console.warn(`Could not switch buffer for album ${albumRow.id}:`, error)
    }
  }
  return getSwitchProgress(database)
}

export async function runBufferSwitchStep(
  env: { meriksirat_d1: D1Database },
  budget: Budget
): Promise<void> {
  await runBufferSwitch(db(env.meriksirat_d1), budget)
}
