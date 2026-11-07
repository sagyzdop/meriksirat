import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Database } from '@/db'
import {
  album,
  favorite,
  flamekeeper,
  flamekeeperGrant,
  settings,
  user,
  volume,
} from '@/db/schema'
import { getBufferFullAccessToken } from '@/lib/buffer/full-token'
import { planBufferUpload } from '@/lib/buffer/plan'
import { ensureBufferVolume } from '@/lib/buffer/server'
import { withBufferToken } from '@/lib/buffer/tokens'
import { getBufferOverview } from '@/lib/buffer/usage-server'
import { createBudget, type Budget } from '@/lib/cron/budget'
import { withFlamekeeperToken } from '@/lib/flamekeeper/tokens'
import { remapDriveFile } from '@/lib/favorites/remap-server'
import { withGoogleToken } from '@/lib/google/google-calendar-auth'
import {
  createDriveFolder,
  deleteDriveFile,
  mintResumableUpload,
} from '@/lib/google/google-drive'
import {
  DEFAULT_FLAMEKEEPER_CAP_BYTES,
  usableBytes,
} from '@/lib/pool/placement'
import { volumeFolderName } from '@/lib/pool/volumes'
import { chunk } from '@/lib/utils'
import {
  copyFilesInto,
  deleteFiles,
  listIdentities,
  shareFolderWith,
} from './storage-drive'
import {
  bufferHasRoom,
  deletionDate,
  matchFiles,
  pendingMatches,
  pickFlamekeeper,
  planMoves,
  verifyCopy,
  type FileIdentity,
  type MovePreview,
  type MoveTarget,
  type OffloadPending,
  type PlacementCandidate,
} from './storage-plan'
import { albumStorageHolder } from './status'
import { newId } from './ids'
import { invalidateCachedDetailCore, invalidateCachedListing } from './server'

const ID_CHUNK = 90
const PENDING_TTL_SECONDS = 6 * 60 * 60
const OVERVIEW_MAX_AGE_MS = 10 * 60 * 1000
const REQUEST_BUDGET = 45
const MINT_BATCH = 30

const bufferVolumeKey = (albumId: string) =>
  and(eq(volume.albumId, albumId), isNull(volume.flamekeeperUserId))

export type MoveFailure = { ok: false; reason: string; bufferFull?: boolean }
export type MoveResult = { ok: true } | MoveFailure

export interface OffloadSession {
  albumId: string
  files: (FileIdentity & { uploaded?: boolean })[]
  downloadToken: string
  uploadUrl: string
  volumeFolderId: string
}

async function loadAlbums(database: Database, albumIds: string[]) {
  const rows = []
  for (const ids of chunk(albumIds, ID_CHUNK)) {
    rows.push(
      ...(await database
        .select({
          id: album.id,
          title: album.title,
          driveFolderId: album.driveFolderId,
          ownerUserId: album.ownerUserId,
          photoBytes: album.photoBytes,
          deletedAt: album.deletedAt,
          scheduledDeletionAt: album.scheduledDeletionAt,
        })
        .from(album)
        .where(inArray(album.id, ids))
        .all())
    )
  }
  return rows
}

async function loadVolumes(database: Database, albumIds: string[]) {
  const rows = []
  for (const ids of chunk(albumIds, ID_CHUNK)) {
    rows.push(
      ...(await database
        .select({
          id: volume.id,
          albumId: volume.albumId,
          flamekeeperUserId: volume.flamekeeperUserId,
          driveFolderId: volume.driveFolderId,
          permissionId: volume.permissionId,
          droppedAt: volume.droppedAt,
          expectedBytes: volume.expectedBytes,
        })
        .from(volume)
        .where(inArray(volume.albumId, ids))
        .all())
    )
  }
  return rows
}

export async function loadPlacementCandidates(
  database: Database
): Promise<(PlacementCandidate & { email: string })[]> {
  const [capRow, rows] = await Promise.all([
    database
      .select({ cap: settings.flamekeeperCapBytes })
      .from(settings)
      .where(eq(settings.id, 'global'))
      .get(),
    database
      .select({
        userId: flamekeeper.userId,
        state: flamekeeper.state,
        pledgedBytes: flamekeeper.pledgedBytes,
        usedBytes: flamekeeper.usedBytes,
        driveUsageBytes: flamekeeper.driveUsageBytes,
        name: user.name,
        email: user.email,
      })
      .from(flamekeeper)
      .innerJoin(user, eq(user.id, flamekeeper.userId))
      .innerJoin(flamekeeperGrant, eq(flamekeeperGrant.userId, user.id))
      .where(eq(flamekeeper.state, 'active'))
      .all(),
  ])
  const cap = capRow?.cap ?? DEFAULT_FLAMEKEEPER_CAP_BYTES
  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    freeBytes: usableBytes(r, cap),
  }))
}

export async function previewMoves(
  database: Database,
  albumIds: string[],
  target: MoveTarget
): Promise<MovePreview> {
  const unique = [...new Set(albumIds)]
  const [albums, volumes, candidates] = await Promise.all([
    loadAlbums(database, unique),
    loadVolumes(database, unique),
    target === 'flamekeeper' ? loadPlacementCandidates(database) : [],
  ])
  const byId = new Map(albums.map((a) => [a.id, a]))
  const inputs = unique
    .filter((id) => byId.has(id))
    .map((id) => {
      const a = byId.get(id)!
      const own = volumes.filter((v) => v.albumId === id)
      const bufferVolume = own.find((v) => !v.flamekeeperUserId)
      return {
        albumId: id,
        title: a.title,
        bytes: bufferVolume?.expectedBytes ?? a.photoBytes,
        holder: albumStorageHolder(own),
        deleted: !!a.deletedAt,
      }
    })
  return planMoves({ albums: inputs, target, candidates })
}

async function recordRemaps(
  database: Database,
  albumId: string,
  pairs: { source: FileIdentity; copy: FileIdentity }[]
): Promise<void> {
  const [favorites, cover] = await Promise.all([
    database
      .selectDistinct({ id: favorite.driveFileId })
      .from(favorite)
      .where(eq(favorite.albumId, albumId))
      .all(),
    database
      .select({ id: album.coverFileId })
      .from(album)
      .where(eq(album.id, albumId))
      .get(),
  ])
  const used = new Set(favorites.map((f) => f.id))
  if (cover?.id) used.add(cover.id)
  for (const pair of pairs) {
    if (!used.has(pair.source.id)) continue
    await remapDriveFile(database, {
      albumId,
      oldFileId: pair.source.id,
      newFileId: pair.copy.id,
    })
  }
}

async function dropEmptyFolder(folderId: string | null): Promise<void> {
  if (!folderId) return
  try {
    await withGoogleToken((token) => deleteDriveFile(token, folderId))
  } catch (error) {
    console.warn('Could not remove an emptied volume folder:', error)
  }
}

async function afterMove(
  albumId: string,
  driveFolderId: string
): Promise<void> {
  await Promise.all([
    invalidateCachedListing(driveFolderId),
    invalidateCachedDetailCore(albumId),
  ])
}

export async function rescueAlbumVolume(
  database: Database,
  albumId: string,
  options: { budget?: Budget; flamekeeperUserId?: string } = {}
): Promise<MoveResult> {
  const { budget } = options
  const albumRow = await database
    .select({
      id: album.id,
      driveFolderId: album.driveFolderId,
      deletedAt: album.deletedAt,
    })
    .from(album)
    .where(eq(album.id, albumId))
    .get()
  if (!albumRow) return { ok: false, reason: 'Album not found' }

  const held = await database
    .select({
      id: volume.id,
      flamekeeperUserId: volume.flamekeeperUserId,
      driveFolderId: volume.driveFolderId,
    })
    .from(volume)
    .where(
      and(
        eq(volume.albumId, albumId),
        isNotNull(volume.flamekeeperUserId),
        options.flamekeeperUserId
          ? eq(volume.flamekeeperUserId, options.flamekeeperUserId)
          : undefined
      )
    )
    .get()
  if (!held?.flamekeeperUserId) {
    return { ok: false, reason: 'No flamekeeper holds this album' }
  }
  const holderId = held.flamekeeperUserId

  const plan = planBufferUpload(process.env)
  if (plan.kind === 'unavailable') return { ok: false, reason: plan.message }

  try {
    const token = await getBufferFullAccessToken()
    const source = held.driveFolderId
      ? await listIdentities(token, held.driveFolderId, budget)
      : []
    const bytes = source.reduce((n, f) => n + f.size, 0)

    const overview = await getBufferOverview(OVERVIEW_MAX_AGE_MS)
    if (
      overview &&
      !bufferHasRoom(overview.usedBytes, overview.limitBytes, bytes)
    ) {
      return { ok: false, reason: 'The buffer is full', bufferFull: true }
    }

    if (budget && !budget.take(4)) {
      return { ok: false, reason: 'Out of budget, continues next run' }
    }
    const destFolderId = await withGoogleToken((master) =>
      ensureBufferVolume(database, master, albumRow, plan.email)
    )

    const existing = await listIdentities(token, destFolderId, budget)
    const toCopy = matchFiles(source, existing).missing
    if (toCopy.length > 0) {
      await copyFilesInto(token, toCopy, destFolderId, budget)
    }
    const copies = await listIdentities(token, destFolderId, budget)
    const check = verifyCopy(source, copies)
    if (!check.ok) {
      return { ok: false, reason: check.reason ?? 'Copy did not verify' }
    }

    await recordRemaps(database, albumId, matchFiles(source, copies).pairs)

    const holderIds = source.map((f) => f.id)
    if (holderIds.length > 0) {
      const failed = await withFlamekeeperToken(
        database,
        holderId,
        (t) => deleteFiles(t, holderIds, budget),
        budget
      )
      if (failed.length > 0) {
        return {
          ok: false,
          reason: `Could not delete ${failed.length} originals from the flamekeeper`,
        }
      }
    }

    const now = new Date()
    const totalBytes = copies.reduce((n, f) => n + f.size, 0)
    await database.batch([
      database.delete(volume).where(eq(volume.id, held.id)),
      database
        .update(volume)
        .set({
          expectedCount: copies.length,
          expectedBytes: totalBytes,
          expectedChangedAt: now,
        })
        .where(bufferVolumeKey(albumId)),
      database
        .update(album)
        .set({ rescuedAt: now, updatedAt: now })
        .where(eq(album.id, albumId)),
      database
        .update(flamekeeper)
        .set({
          usedBytes: sql`MAX(${flamekeeper.usedBytes} - ${bytes}, 0)`,
          driveUsageBytes: sql`MAX(${flamekeeper.driveUsageBytes} - ${bytes}, 0)`,
          updatedAt: now,
        })
        .where(eq(flamekeeper.userId, holderId)),
    ])
    await dropEmptyFolder(held.driveFolderId)
    await afterMove(albumId, albumRow.driveFolderId)
    return { ok: true }
  } catch (error) {
    console.warn(`Rescue of album ${albumId} did not finish:`, error)
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Rescue failed',
    }
  }
}

export async function moveAlbumsToBuffer(
  database: Database,
  albumIds: string[]
): Promise<{ moved: number; skipped: { albumId: string; reason: string }[] }> {
  const preview = await previewMoves(database, albumIds, 'buffer')
  const skipped: { albumId: string; reason: string }[] = []
  let moved = 0
  const budget = createBudget(REQUEST_BUDGET)
  for (const item of preview.items) {
    if (item.skipReason) {
      skipped.push({ albumId: item.albumId, reason: item.skipReason })
      continue
    }
    const result = await rescueAlbumVolume(database, item.albumId, { budget })
    if (result.ok) moved++
    else skipped.push({ albumId: item.albumId, reason: result.reason })
  }
  return { moved, skipped }
}

async function kv(): Promise<KVNamespace> {
  const { env } = await import('cloudflare:workers')
  return env.meriksirat_kv as KVNamespace
}

const pendingKey = (albumId: string) => `album:offload:${albumId}`

async function readPending(albumId: string): Promise<OffloadPending | null> {
  const raw = await (await kv()).get(pendingKey(albumId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as OffloadPending
  } catch {
    return null
  }
}

async function writePending(albumId: string, pending: OffloadPending) {
  await (
    await kv()
  ).put(pendingKey(albumId), JSON.stringify(pending), {
    expirationTtl: PENDING_TTL_SECONDS,
  })
}

async function clearPending(albumId: string) {
  try {
    await (await kv()).delete(pendingKey(albumId))
  } catch (error) {
    console.warn('Could not clear offload state:', error)
  }
}

export async function startOffload(
  database: Database,
  albumIds: string[],
  origin: string | undefined
): Promise<OffloadSession[]> {
  const unique = [...new Set(albumIds)]
  const [albums, volumes, candidates] = await Promise.all([
    loadAlbums(database, unique),
    loadVolumes(database, unique),
    loadPlacementCandidates(database),
  ])
  const free = new Map(candidates.map((c) => [c.userId, c.freeBytes]))
  const emails = new Map(candidates.map((c) => [c.userId, c.email]))
  const plan = planBufferUpload(process.env)
  if (plan.kind === 'unavailable') throw new Error(plan.message)

  const budget = createBudget(REQUEST_BUDGET)
  const sessions: OffloadSession[] = []
  let firstFailure: string | null = null

  for (const id of unique) {
    const albumRow = albums.find((a) => a.id === id)
    if (!albumRow || albumRow.deletedAt) continue
    const own = volumes.filter((v) => v.albumId === id)
    if (albumStorageHolder(own) !== 'buffer') continue
    const bufferVolume = own.find((v) => !v.flamekeeperUserId)
    if (!bufferVolume?.driveFolderId) continue
    if (!budget.take(10)) break

    try {
      const files = await withBufferToken(
        (t) => listIdentities(t, bufferVolume.driveFolderId!),
        budget
      )
      const bytes = files.reduce((n, f) => n + f.size, 0)
      const prior = await readPending(id)
      const priorUsable =
        prior && (free.get(prior.destUserId) ?? 0) >= prior.bytes
      const pick = priorUsable
        ? { userId: prior!.destUserId }
        : pickFlamekeeper(
            bytes,
            [...free].map(([userId, freeBytes]) => ({ userId, freeBytes }))
          )
      if (!pick) {
        firstFailure ??= 'No flamekeeper has room'
        continue
      }
      const destUserId = pick.userId

      let folderId = prior && priorUsable ? prior.volumeFolderId : ''
      let permissionId = prior && priorUsable ? prior.permissionId : ''
      if (!folderId) {
        const setup = await withGoogleToken(async (master) => {
          const created = await createDriveFolder(
            master,
            volumeFolderName(newId(6)),
            albumRow.driveFolderId
          )
          const writer = await shareFolderWith(
            master,
            created.id,
            emails.get(destUserId)!,
            'writer'
          )
          await shareFolderWith(master, created.id, plan.email, 'reader')
          return { folderId: created.id, permissionId: writer }
        }, budget)
        folderId = setup.folderId
        permissionId = setup.permissionId
      }

      const pending: OffloadPending = {
        destUserId,
        volumeFolderId: folderId,
        permissionId,
        bytes,
        files,
      }
      free.set(destUserId, (free.get(destUserId) ?? 0) - bytes)

      const uploadUrl = files[0]
        ? await mintFor(database, pending, files[0].id, origin, budget)
        : ''
      await writePending(id, pending)
      const downloadToken = await withBufferToken(async (t) => t)
      const already =
        prior && priorUsable
          ? new Set(
              matchFiles(
                files,
                await withFlamekeeperToken(
                  database,
                  destUserId,
                  (t) => listIdentities(t, folderId, budget),
                  budget
                )
              ).pairs.map((p) => p.source.id)
            )
          : new Set<string>()
      sessions.push({
        albumId: id,
        files: files.map(({ id: fileId, name, size, md5 }) => ({
          id: fileId,
          name,
          size,
          md5,
          ...(already.has(fileId) && { uploaded: true }),
        })),
        downloadToken,
        uploadUrl,
        volumeFolderId: folderId,
      })
    } catch (error) {
      console.warn(`Could not start the offload of album ${id}:`, error)
      firstFailure ??= error instanceof Error ? error.message : 'Failed'
    }
  }

  if (sessions.length === 0 && firstFailure) throw new Error(firstFailure)
  return sessions
}

async function mintFor(
  database: Database,
  pending: OffloadPending,
  fileId: string,
  origin: string | undefined,
  budget?: Budget
): Promise<string> {
  const file = pending.files.find((f) => f.id === fileId)
  if (!file) throw new Error('Unknown file in this move')
  return withFlamekeeperToken(
    database,
    pending.destUserId,
    (t) =>
      mintResumableUpload(t, {
        name: file.name,
        folderId: pending.volumeFolderId,
        mimeType: file.mimeType || 'application/octet-stream',
        size: file.size,
        origin,
      }),
    budget
  )
}

export async function mintOffloadUploads(
  database: Database,
  input: { albumId: string; fileIds: string[]; origin?: string }
): Promise<Record<string, string>> {
  const pending = await readPending(input.albumId)
  if (!pending) throw new Error('This move expired, start it again')
  const out: Record<string, string> = {}
  for (const fileId of input.fileIds.slice(0, MINT_BATCH)) {
    out[fileId] = await mintFor(database, pending, fileId, input.origin)
  }
  return out
}

export async function completeOffload(
  database: Database,
  input: {
    albumId: string
    volumeFolderId: string
    files: FileIdentity[]
  }
): Promise<MoveResult> {
  const { albumId } = input
  const pending = await readPending(albumId)
  if (!pending)
    return { ok: false, reason: 'This move expired, start it again' }
  if (!pendingMatches(pending, input.volumeFolderId, input.files)) {
    return { ok: false, reason: 'The move does not match what was started' }
  }

  const albumRow = await database
    .select({ id: album.id, driveFolderId: album.driveFolderId })
    .from(album)
    .where(eq(album.id, albumId))
    .get()
  const bufferVolume = await database
    .select({ id: volume.id, driveFolderId: volume.driveFolderId })
    .from(volume)
    .where(bufferVolumeKey(albumId))
    .get()
  if (!albumRow || !bufferVolume) {
    return { ok: false, reason: 'The album is no longer on the buffer' }
  }

  try {
    const [source, copies] = await Promise.all([
      bufferVolume.driveFolderId
        ? withBufferToken((t) => listIdentities(t, bufferVolume.driveFolderId!))
        : [],
      withFlamekeeperToken(database, pending.destUserId, (t) =>
        listIdentities(t, pending.volumeFolderId)
      ),
    ])
    const check = verifyCopy(source, copies)
    if (!check.ok) {
      return { ok: false, reason: check.reason ?? 'Copy did not verify' }
    }

    await recordRemaps(database, albumId, matchFiles(source, copies).pairs)

    if (source.length > 0) {
      const failed = await withBufferToken((t) =>
        deleteFiles(
          t,
          source.map((f) => f.id)
        )
      )
      if (failed.length > 0) {
        return {
          ok: false,
          reason: `Could not delete ${failed.length} originals from the buffer`,
        }
      }
    }

    const now = new Date()
    const bytes = copies.reduce((n, f) => n + f.size, 0)
    await database.batch([
      database.delete(volume).where(eq(volume.id, bufferVolume.id)),
      database.insert(volume).values({
        id: newId(10),
        albumId,
        flamekeeperUserId: pending.destUserId,
        permissionId: pending.permissionId,
        driveFolderId: pending.volumeFolderId,
        expectedCount: copies.length,
        expectedBytes: bytes,
        expectedChangedAt: now,
      }),
      database
        .update(album)
        .set({ rescuedAt: null, updatedAt: now })
        .where(eq(album.id, albumId)),
      database
        .update(flamekeeper)
        .set({
          usedBytes: sql`${flamekeeper.usedBytes} + ${bytes}`,
          driveUsageBytes: sql`${flamekeeper.driveUsageBytes} + ${bytes}`,
          updatedAt: now,
        })
        .where(eq(flamekeeper.userId, pending.destUserId)),
    ])
    await clearPending(albumId)
    await dropEmptyFolder(bufferVolume.driveFolderId)
    await afterMove(albumId, albumRow.driveFolderId)
    return { ok: true }
  } catch (error) {
    console.warn(`Offload of album ${albumId} did not complete:`, error)
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Offload failed',
    }
  }
}

export async function scheduleAlbumsDeletion(
  database: Database,
  albumIds: string[],
  env: { TELEGRAM_BOT_TOKEN?: string; BETTER_AUTH_URL?: string },
  now: Date = new Date()
): Promise<{ scheduled: number; skipped: number }> {
  const unique = [...new Set(albumIds)]
  const [row, albums] = await Promise.all([
    database
      .select({ days: settings.albumDeletionNoticeDays })
      .from(settings)
      .where(eq(settings.id, 'global'))
      .get(),
    loadAlbums(database, unique),
  ])
  const at = deletionDate(now, row?.days ?? 14)
  const due = albums.filter((a) => !a.deletedAt && !a.scheduledDeletionAt)
  for (const ids of chunk(
    due.map((a) => a.id),
    ID_CHUNK
  )) {
    await database
      .update(album)
      .set({ scheduledDeletionAt: at, updatedAt: now })
      .where(and(inArray(album.id, ids), isNull(album.deletedAt)))
  }
  const { notifyAlbumScheduledDeletion } = await import('@/lib/pool/notices')
  for (const a of due) {
    await notifyAlbumScheduledDeletion(database, env, a, at)
    await invalidateCachedDetailCore(a.id)
  }
  return { scheduled: due.length, skipped: unique.length - due.length }
}

export async function cancelAlbumsDeletion(
  database: Database,
  albumIds: string[]
): Promise<{ cancelled: number }> {
  const unique = [...new Set(albumIds)]
  const albums = (await loadAlbums(database, unique)).filter(
    (a) => a.scheduledDeletionAt
  )
  const now = new Date()
  for (const ids of chunk(
    albums.map((a) => a.id),
    ID_CHUNK
  )) {
    await database
      .update(album)
      .set({ scheduledDeletionAt: null, updatedAt: now })
      .where(inArray(album.id, ids))
  }
  for (const a of albums) await invalidateCachedDetailCore(a.id)
  return { cancelled: albums.length }
}
