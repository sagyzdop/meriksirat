import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
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
import { forgetBufferAccessToken, withBufferToken } from '@/lib/buffer/tokens'
import { getBufferOverview } from '@/lib/buffer/usage-server'
import { createBudget, type Budget } from '@/lib/cron/budget'
import {
  FlamekeeperGrantError,
  withFlamekeeperToken,
} from '@/lib/flamekeeper/tokens'
import { remapDriveFile } from '@/lib/favorites/remap-server'
import { withGoogleToken } from '@/lib/google/google-calendar-auth'
import {
  DriveNotFoundError,
  createDriveFolder,
  deleteDriveFile,
  getDriveFolderState,
  mintResumableUpload,
  shareWithWriter,
} from '@/lib/google/google-drive'
import {
  DEFAULT_FLAMEKEEPER_CAP_BYTES,
  usableBytes,
} from '@/lib/pool/placement'
import { syncKeepingStates } from '@/lib/pool/server'
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
  canReusePending,
  deletionDate,
  goneFromSource,
  matchFiles,
  matchVolumeCopies,
  nextOffloadStep,
  offloadCopiesToKeep,
  planMoves,
  planOffloadVolumes,
  trimPending,
  unknownSourceFiles,
  type FileIdentity,
  type MovePreview,
  type MoveTarget,
  type OffloadCompletion,
  type OffloadCopy,
  type OffloadMint,
  type OffloadPending,
  type OffloadPendingFile,
  type OffloadPendingVolume,
  type OffloadStart,
  type PlacementCandidate,
} from './storage-plan'
import {
  albumMoveInProgress,
  clearOffloadPending,
  clearRescueMarker,
  markRescueStarted,
  readOffloadPending,
  writeOffloadPending,
} from './offload-pending'
import type { ListingOwner } from './listing'
import { withListingOwnerToken } from './listing-server'
import { albumStorageHolder } from './status'
import { packFiles } from './volume-limit'
import { newId } from './ids'
import { invalidateCachedDetailCore, invalidateCachedListing } from './server'

const ID_CHUNK = 90
const OVERVIEW_MAX_AGE_MS = 10 * 60 * 1000
const REQUEST_BUDGET = 45
const MINT_BATCH = 30
const CLEANUP_MIN_AGE_MS = 15 * 60 * 1000
const EXPIRED = 'This move expired, start it again'

export type MoveFailure = { ok: false; reason: string; bufferFull?: boolean }
export type MoveResult = { ok: true } | MoveFailure

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
      const buffered = own.filter((v) => !v.flamekeeperUserId && !v.droppedAt)
      return {
        albumId: id,
        title: a.title,
        bytes: buffered.length
          ? buffered.reduce((n, v) => n + (v.expectedBytes ?? 0), 0)
          : a.photoBytes,
        holder: albumStorageHolder(own),
        deleted: !!a.deletedAt,
      }
    })
  return planMoves({ albums: inputs, target, candidates })
}

async function recordRemaps(
  database: Database,
  albumId: string,
  pairs: OffloadCopy[]
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
    if (!used.has(pair.sourceId)) continue
    await remapDriveFile(database, {
      albumId,
      oldFileId: pair.sourceId,
      newFileId: pair.copyId,
    })
  }
}

async function dropEmptyFolder(
  folderId: string | null,
  budget?: Budget
): Promise<void> {
  if (!folderId) return
  if (budget && !budget.take(1)) return
  try {
    await withGoogleToken((token) => deleteDriveFile(token, folderId), budget)
  } catch (error) {
    if (error instanceof DriveNotFoundError) return
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

async function listOrEmpty(
  run: () => Promise<FileIdentity[]>
): Promise<FileIdentity[]> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof DriveNotFoundError) return []
    throw error
  }
}

/**
 * Removes what dropped volume rows still hold: buffer originals after an
 * offload, flamekeeper originals after a rescue, and partial copies of an
 * abandoned offload or rescue. Rows of an album with a move in progress are
 * left alone, and so are rows whose flamekeeper cannot be reached (lost or
 * stopped); those wait until the owner reconnects. Returns how many of the
 * rows it looked at are still there.
 */
export async function cleanDroppedVolumes(
  database: Database,
  budget: Budget,
  options: {
    albumId?: string
    flamekeeperUserId?: string
    limit?: number
    minAgeMs?: number
    now?: Date
  } = {}
): Promise<number> {
  const now = options.now ?? new Date()
  const rows = await database
    .select({
      id: volume.id,
      albumId: volume.albumId,
      flamekeeperUserId: volume.flamekeeperUserId,
      driveFolderId: volume.driveFolderId,
      droppedAt: volume.droppedAt,
      state: flamekeeper.state,
    })
    .from(volume)
    .leftJoin(flamekeeper, eq(flamekeeper.userId, volume.flamekeeperUserId))
    .where(
      and(
        isNotNull(volume.droppedAt),
        options.albumId ? eq(volume.albumId, options.albumId) : undefined,
        options.flamekeeperUserId
          ? eq(volume.flamekeeperUserId, options.flamekeeperUserId)
          : undefined
      )
    )
    .orderBy(asc(volume.droppedAt))
    .limit(options.limit ?? 10)
    .all()

  const minAge = options.minAgeMs ?? CLEANUP_MIN_AGE_MS
  const moving = new Map<string, boolean>()
  let left = rows.length
  for (const row of rows) {
    if (!budget.canAfford(4)) break
    if (now.getTime() - (row.droppedAt?.getTime() ?? 0) < minAge) continue
    if (
      row.flamekeeperUserId &&
      (!row.state || row.state === 'lost' || row.state === 'drained')
    ) {
      continue
    }
    if (!moving.has(row.albumId)) {
      moving.set(row.albumId, await albumMoveInProgress(row.albumId))
    }
    if (moving.get(row.albumId)) continue

    const owner: ListingOwner = row.flamekeeperUserId
      ? { kind: 'flamekeeper', userId: row.flamekeeperUserId }
      : { kind: 'buffer' }
    try {
      if (row.driveFolderId) {
        const folderId = row.driveFolderId
        const files = await listOrEmpty(() =>
          withListingOwnerToken(
            database,
            owner,
            (t) => listIdentities(t, folderId, budget),
            budget
          )
        )
        if (files.length > 0) {
          const failed = await withListingOwnerToken(
            database,
            owner,
            (t) =>
              deleteFiles(
                t,
                files.map((f) => f.id),
                budget
              ),
            budget
          )
          if (failed.length > 0) continue
        }
        await dropEmptyFolder(folderId, budget)
      }
      await database
        .delete(volume)
        .where(and(eq(volume.id, row.id), isNotNull(volume.droppedAt)))
      left--
    } catch (error) {
      if (error instanceof FlamekeeperGrantError) continue
      console.warn(`Could not clean dropped volume ${row.id}:`, error)
    }
  }
  return left
}

async function ensureRescueVolume(
  database: Database,
  albumRow: { id: string; driveFolderId: string },
  volumeId: string,
  bufferEmail: string,
  budget?: Budget
): Promise<{ volumeId: string; folderId: string }> {
  const existing = await database
    .select({ driveFolderId: volume.driveFolderId })
    .from(volume)
    .where(eq(volume.id, volumeId))
    .get()
  if (existing?.driveFolderId) {
    return { volumeId, folderId: existing.driveFolderId }
  }
  if (budget && !budget.take(2)) {
    throw new Error('Out of budget, continues next run')
  }
  const setup = await withGoogleToken(async (master) => {
    const created = await createDriveFolder(
      master,
      volumeFolderName(newId(6)),
      albumRow.driveFolderId
    )
    const permissionId = await shareWithWriter(master, created.id, bufferEmail)
    return { folderId: created.id, permissionId }
  }, budget)
  const values = {
    driveFolderId: setup.folderId,
    permissionId: setup.permissionId,
    droppedAt: new Date(),
    expectedCount: 0,
    expectedBytes: 0,
  }
  await database
    .insert(volume)
    .values({ id: volumeId, albumId: albumRow.id, ...values })
    .onConflictDoUpdate({ target: volume.id, set: values })
  return { volumeId, folderId: setup.folderId }
}

async function readHeldVolume(
  database: Database,
  token: string,
  holder: { flamekeeperUserId: string; driveFolderId: string | null },
  budget?: Budget
): Promise<{ ok: true; files: FileIdentity[] } | MoveFailure> {
  const folderId = holder.driveFolderId
  if (!folderId) return { ok: true, files: [] }
  let state = await getDriveFolderState(token, folderId)
  if (state === 'missing') {
    state = await withGoogleToken(
      (master) => getDriveFolderState(master, folderId),
      budget
    )
    if (state !== 'missing') {
      return {
        ok: false,
        reason: 'The buffer cannot read a volume folder of this album',
      }
    }
    return { ok: true, files: [] }
  }
  const files = await listIdentities(token, folderId, budget)
  let own: FileIdentity[] | null = null
  try {
    own = await withFlamekeeperToken(
      database,
      holder.flamekeeperUserId,
      (t) => listIdentities(t, folderId, budget),
      budget
    )
  } catch (error) {
    if (!(error instanceof FlamekeeperGrantError)) throw error
  }
  const seen = new Set(files.map((f) => f.id))
  if (own?.some((f) => !seen.has(f.id))) {
    return {
      ok: false,
      reason: 'The buffer cannot see every photo of a volume',
    }
  }
  return { ok: true, files }
}

/**
 * Moves the live flamekeeper volumes of one album back to the buffer. The
 * buffer's full-scope token copies the photos (it reads the volume folders,
 * which are shared with the buffer), works for a lost flamekeeper too, and
 * stages the copies in dropped buffer volumes until every group verifies.
 * Then one batch makes the copies live and drops the flamekeeper volumes;
 * their originals are deleted afterwards with the owner's token, or later
 * once a lost owner reconnects.
 */
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
        isNull(volume.droppedAt),
        options.flamekeeperUserId
          ? eq(volume.flamekeeperUserId, options.flamekeeperUserId)
          : undefined
      )
    )
    .all()
  const holders = held
    .filter(
      (h): h is typeof h & { flamekeeperUserId: string } =>
        !!h.flamekeeperUserId
    )
    .sort((a, b) => a.id.localeCompare(b.id))
  if (holders.length === 0) {
    return { ok: false, reason: 'No flamekeeper holds this album' }
  }

  const plan = planBufferUpload(process.env)
  if (plan.kind === 'unavailable') return { ok: false, reason: plan.message }

  try {
    await markRescueStarted(albumId)
    const token = await getBufferFullAccessToken()
    const sources: {
      holder: (typeof holders)[number]
      files: FileIdentity[]
    }[] = []
    for (const holder of holders) {
      const read = await readHeldVolume(database, token, holder, budget)
      if (!read.ok) return read
      sources.push({ holder, files: read.files })
    }
    const source = sources.flatMap((s) => s.files)
    const bytes = source.reduce((n, f) => n + f.size, 0)

    const overview = await getBufferOverview(OVERVIEW_MAX_AGE_MS)
    if (
      overview &&
      !bufferHasRoom(overview.usedBytes, overview.limitBytes, bytes)
    ) {
      return { ok: false, reason: 'The buffer is full', bufferFull: true }
    }

    const destinations: {
      volumeId: string
      copies: OffloadCopy[]
      bytes: number
    }[] = []
    for (const [index, group] of packFiles(source).entries()) {
      if (budget && !budget.take(4)) {
        return { ok: false, reason: 'Out of budget, continues next run' }
      }
      const dest = await ensureRescueVolume(
        database,
        albumRow,
        `r${index}-${holders[0].id}`,
        plan.email,
        budget
      )
      const existing = await listIdentities(token, dest.folderId, budget)
      const toCopy = matchFiles(group, existing).missing
      if (toCopy.length > 0) {
        await copyFilesInto(token, toCopy, dest.folderId, budget)
      }
      const listed = await listIdentities(token, dest.folderId, budget)
      const match = matchVolumeCopies(group, listed)
      if (match.missing.length > 0) {
        return {
          ok: false,
          reason: `${match.missing.length} photos did not copy to the buffer`,
        }
      }
      if (match.extras.length > 0) {
        const failed = await deleteFiles(token, match.extras, budget)
        if (failed.length > 0) {
          return { ok: false, reason: 'Could not remove duplicate copies' }
        }
      }
      destinations.push({
        volumeId: dest.volumeId,
        copies: match.copies,
        bytes: match.copies.reduce((n, c) => n + c.size, 0),
      })
    }

    await recordRemaps(
      database,
      albumId,
      destinations.flatMap((d) => d.copies)
    )

    const now = new Date()
    const released = new Map<string, number>()
    for (const { holder, files } of sources) {
      released.set(
        holder.flamekeeperUserId,
        (released.get(holder.flamekeeperUserId) ?? 0) +
          files.reduce((n, f) => n + f.size, 0)
      )
    }
    await database.batch([
      database
        .update(volume)
        .set({ droppedAt: now })
        .where(
          inArray(
            volume.id,
            holders.map((h) => h.id)
          )
        ),
      ...destinations.map((d) =>
        database
          .update(volume)
          .set({
            droppedAt: null,
            expectedCount: d.copies.length,
            expectedBytes: d.bytes,
            expectedChangedAt: now,
          })
          .where(eq(volume.id, d.volumeId))
      ),
      database
        .update(album)
        .set({ rescuedAt: now, updatedAt: now })
        .where(eq(album.id, albumId)),
      ...[...released].map(([userId, freed]) =>
        database
          .update(flamekeeper)
          .set({
            usedBytes: sql`MAX(${flamekeeper.usedBytes} - ${freed}, 0)`,
            driveUsageBytes: sql`MAX(${flamekeeper.driveUsageBytes} - ${freed}, 0)`,
            updatedAt: now,
          })
          .where(eq(flamekeeper.userId, userId))
      ),
    ] as unknown as Parameters<typeof database.batch>[0])
    await clearRescueMarker(albumId)
    await syncKeepingStates(database, [...released.keys()])
    await afterMove(albumId, albumRow.driveFolderId)
    try {
      await cleanDroppedVolumes(database, budget ?? createBudget(), {
        albumId,
        minAgeMs: 0,
        now,
      })
    } catch (error) {
      console.warn(`Could not clean up after rescuing album ${albumId}:`, error)
    }
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
    else {
      skipped.push({
        albumId: item.albumId,
        reason: result.reason.startsWith('Out of budget')
          ? 'Not finished in one go; run Move to Buffer again to continue'
          : result.reason,
      })
    }
  }
  return { moved, skipped }
}

export async function startOffload(
  database: Database,
  albumIds: string[]
): Promise<OffloadStart[]> {
  const unique = [...new Set(albumIds)]
  const [albums, volumes, candidates] = await Promise.all([
    loadAlbums(database, unique),
    loadVolumes(database, unique),
    loadPlacementCandidates(database),
  ])
  const free = new Map(candidates.map((c) => [c.userId, c.freeBytes]))
  const plan = planBufferUpload(process.env)
  if (plan.kind === 'unavailable') throw new Error(plan.message)

  const budget = createBudget(REQUEST_BUDGET)
  const sessions: Omit<OffloadStart, 'downloadToken'>[] = []
  let firstFailure: string | null = null

  for (const id of unique) {
    const albumRow = albums.find((a) => a.id === id)
    if (!albumRow || albumRow.deletedAt) {
      firstFailure ??= 'Album was deleted'
      continue
    }
    const own = volumes.filter((v) => v.albumId === id)
    if (albumStorageHolder(own) !== 'buffer') {
      firstFailure ??= 'Only albums held by the buffer can move'
      continue
    }
    const bufferFolders = own
      .filter((v) => !v.flamekeeperUserId && !v.droppedAt && v.driveFolderId)
      .map((v) => v.driveFolderId!)
    if (!budget.canAfford(bufferFolders.length + 4)) {
      firstFailure ??= 'Too many albums at once; start the rest again'
      break
    }

    try {
      const files: OffloadPendingFile[] = []
      for (const folderId of bufferFolders) {
        const listed = await withBufferToken(
          (t) => listIdentities(t, folderId, budget),
          budget
        )
        files.push(...listed.map((f) => ({ ...f, sourceFolderId: folderId })))
      }
      if (files.length === 0) {
        firstFailure ??= 'The album has no photos to move'
        continue
      }

      const prior = await readOffloadPending(id)
      let pending: OffloadPending
      if (
        prior &&
        canReusePending(
          prior,
          files.map((f) => f.id),
          free
        )
      ) {
        pending = {
          ...trimPending(
            prior,
            files.map((f) => f.id)
          ),
          sourceFolders: bufferFolders,
          checkedFolders: [],
          goneSources: [],
        }
      } else {
        const planned = planOffloadVolumes(
          files,
          [...free].map(([userId, freeBytes]) => ({ userId, freeBytes }))
        )
        if (!planned) {
          firstFailure ??= 'No flamekeeper has room'
          continue
        }
        pending = {
          startedAt: Date.now(),
          sourceFolders: bufferFolders,
          checkedFolders: [],
          goneSources: [],
          volumes: planned.map((p) => ({
            volumeId: newId(10),
            destUserId: p.userId,
            volumeFolderId: null,
            permissionId: null,
            bytes: p.bytes,
            files: p.files,
          })),
        }
      }
      for (const v of pending.volumes) {
        free.set(v.destUserId, (free.get(v.destUserId) ?? 0) - v.bytes)
      }
      await writeOffloadPending(id, pending)
      sessions.push({
        albumId: id,
        files: pending.volumes.flatMap((v) =>
          v.files.map(({ id: fileId, name, size, md5 }) => ({
            id: fileId,
            name,
            size,
            md5,
          }))
        ),
      })
    } catch (error) {
      console.warn(`Could not start the offload of album ${id}:`, error)
      firstFailure ??= error instanceof Error ? error.message : 'Failed'
    }
  }

  if (sessions.length === 0) throw new Error(firstFailure ?? 'Nothing to move')
  const downloadToken = await withBufferToken(async (t) => t, budget)
  return sessions.map((s) => ({ ...s, downloadToken }))
}

async function createOffloadVolume(
  database: Database,
  albumRow: { id: string; driveFolderId: string },
  dest: OffloadPendingVolume,
  bufferEmail: string,
  budget: Budget
): Promise<void> {
  const owner = await database
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, dest.destUserId))
    .get()
  if (!owner) throw new Error('A flamekeeper in this move no longer exists')
  if (!budget.take(3)) throw new Error('Too many folders at once, try again')
  const setup = await withGoogleToken(async (master) => {
    const created = await createDriveFolder(
      master,
      volumeFolderName(newId(6)),
      albumRow.driveFolderId
    )
    const writer = await shareFolderWith(
      master,
      created.id,
      owner.email,
      'writer'
    )
    await shareFolderWith(master, created.id, bufferEmail, 'reader')
    return { folderId: created.id, permissionId: writer }
  }, budget)
  const values = {
    flamekeeperUserId: dest.destUserId,
    driveFolderId: setup.folderId,
    permissionId: setup.permissionId,
    droppedAt: new Date(),
  }
  await database
    .insert(volume)
    .values({ id: dest.volumeId, albumId: albumRow.id, ...values })
    .onConflictDoUpdate({ target: volume.id, set: values })
  dest.volumeFolderId = setup.folderId
  dest.permissionId = setup.permissionId
}

export async function mintOffloadUploads(
  database: Database,
  input: { albumId: string; fileIds: string[]; origin?: string }
): Promise<OffloadMint> {
  const pending = await readOffloadPending(input.albumId)
  if (!pending) throw new Error(EXPIRED)
  const plan = planBufferUpload(process.env)
  if (plan.kind === 'unavailable') throw new Error(plan.message)
  const albumRow = await database
    .select({ id: album.id, driveFolderId: album.driveFolderId })
    .from(album)
    .where(eq(album.id, input.albumId))
    .get()
  if (!albumRow) throw new Error('Album not found')

  const budget = createBudget(REQUEST_BUDGET)
  const wanted = new Set(input.fileIds.slice(0, MINT_BATCH))
  const urls: Record<string, string> = {}
  const uploaded: string[] = []
  for (const dest of pending.volumes) {
    const files = dest.files.filter((f) => wanted.has(f.id))
    if (files.length === 0) continue
    let present = new Set<string>()
    if (!dest.volumeFolderId) {
      await createOffloadVolume(database, albumRow, dest, plan.email, budget)
      await writeOffloadPending(input.albumId, pending)
    } else {
      const folderId = dest.volumeFolderId
      const listed = await withFlamekeeperToken(
        database,
        dest.destUserId,
        (t) => listIdentities(t, folderId, budget),
        budget
      )
      present = new Set(matchFiles(files, listed).pairs.map((p) => p.source.id))
    }
    for (const file of files) {
      if (present.has(file.id)) {
        uploaded.push(file.id)
        continue
      }
      if (!budget.take(1)) break
      urls[file.id] = await withFlamekeeperToken(
        database,
        dest.destUserId,
        (t) =>
          mintResumableUpload(t, {
            name: file.name,
            folderId: dest.volumeFolderId!,
            mimeType: file.mimeType || 'application/octet-stream',
            size: file.size,
            origin: input.origin,
          }),
        budget
      )
    }
  }
  const downloadToken = await withBufferToken(async (t) => t, budget)
  return { urls, uploaded, downloadToken }
}

export async function offloadDownloadToken(albumId: string): Promise<string> {
  if (!(await readOffloadPending(albumId))) throw new Error(EXPIRED)
  forgetBufferAccessToken()
  return withBufferToken(async (t) => t)
}

/**
 * Finishes an offload in steps, each saved to KV so a call cut short by the
 * request budget resumes where it stopped: verify every destination volume
 * holds a copy of each planned photo, check the buffer gained no photos, then
 * remove duplicate copies and swap the volume rows in one batch. The buffer
 * originals are deleted afterwards by the dropped-volume cleanup.
 */
export async function completeOffload(
  database: Database,
  albumId: string
): Promise<OffloadCompletion> {
  const albumRow = await database
    .select({
      id: album.id,
      driveFolderId: album.driveFolderId,
      deletedAt: album.deletedAt,
    })
    .from(album)
    .where(eq(album.id, albumId))
    .get()
  if (!albumRow || albumRow.deletedAt) {
    return { ok: false, reason: 'Album was deleted' }
  }
  const pending = await readOffloadPending(albumId)
  if (!pending) {
    const live = await database
      .select({ flamekeeperUserId: volume.flamekeeperUserId })
      .from(volume)
      .where(and(eq(volume.albumId, albumId), isNull(volume.droppedAt)))
      .all()
    return albumStorageHolder(live) === 'flamekeeper'
      ? { ok: true, done: true }
      : { ok: false, reason: EXPIRED }
  }

  const budget = createBudget(REQUEST_BUDGET)
  try {
    while (true) {
      const step = nextOffloadStep(pending)
      if (step.kind === 'commit') break
      if (!budget.canAfford(4)) {
        await writeOffloadPending(albumId, pending)
        return { ok: true, done: false }
      }
      if (step.kind === 'verify') {
        const dest = pending.volumes.find((v) => v.volumeId === step.volumeId)!
        const folderId = dest.volumeFolderId
        if (!folderId && dest.files.length === 0) {
          dest.copies = []
          dest.extras = []
          continue
        }
        if (!folderId) {
          return {
            ok: false,
            reason: `${dest.files.length} photos were not copied yet. Start the move again to finish it.`,
          }
        }
        const listed = await withFlamekeeperToken(
          database,
          dest.destUserId,
          (t) => listIdentities(t, folderId, budget),
          budget
        )
        const match = matchVolumeCopies(dest.files, listed)
        if (match.missing.length > 0) {
          return {
            ok: false,
            reason: `${match.missing.length} photos did not reach the flamekeeper. Start the move again to finish them.`,
          }
        }
        dest.copies = match.copies
        dest.extras = match.extras
      } else {
        const listed = await listOrEmpty(() =>
          withBufferToken(
            (t) => listIdentities(t, step.folderId, budget),
            budget
          )
        )
        const ids = listed.map((f) => f.id)
        if (unknownSourceFiles(pending, ids).length > 0) {
          return {
            ok: false,
            reason:
              'New photos reached this album during the move. Start the move again.',
          }
        }
        pending.goneSources = [
          ...(pending.goneSources ?? []),
          ...goneFromSource(pending, step.folderId, ids),
        ]
        pending.checkedFolders.push(step.folderId)
      }
    }

    const destIds = [...new Set(pending.volumes.map((v) => v.destUserId))]
    const keepers = await database
      .select({ userId: flamekeeper.userId, state: flamekeeper.state })
      .from(flamekeeper)
      .innerJoin(
        flamekeeperGrant,
        eq(flamekeeperGrant.userId, flamekeeper.userId)
      )
      .where(inArray(flamekeeper.userId, destIds))
      .all()
    const keeping = new Set(
      keepers
        .filter((k) => k.state === 'active' || k.state === 'full')
        .map((k) => k.userId)
    )
    if (!destIds.every((id) => keeping.has(id))) {
      return {
        ok: false,
        reason:
          'A flamekeeper stopped or lost Drive access during the move. Start the move again.',
      }
    }

    const gone = new Set(pending.goneSources ?? [])
    for (const dest of pending.volumes) {
      const { keep, drop } = offloadCopiesToKeep(dest, gone)
      if (drop.length === 0) continue
      if (!budget.canAfford(3 + Math.ceil(drop.length / 100))) {
        await writeOffloadPending(albumId, pending)
        return { ok: true, done: false }
      }
      const failed = await withFlamekeeperToken(
        database,
        dest.destUserId,
        (t) => deleteFiles(t, drop, budget),
        budget
      )
      if (failed.length > 0) {
        return {
          ok: false,
          reason: `Could not remove ${failed.length} duplicate copies from the flamekeeper`,
        }
      }
      dest.copies = keep
      dest.extras = []
    }

    const pairs = pending.volumes.flatMap((v) => v.copies ?? [])
    await recordRemaps(database, albumId, pairs)

    const now = new Date()
    const added = new Map<string, number>()
    const live = pending.volumes.filter((v) => (v.copies ?? []).length > 0)
    const statements = live.map((dest) => {
      const copies = dest.copies ?? []
      const bytes = copies.reduce((n, c) => n + c.size, 0)
      added.set(dest.destUserId, (added.get(dest.destUserId) ?? 0) + bytes)
      const values = {
        flamekeeperUserId: dest.destUserId,
        driveFolderId: dest.volumeFolderId,
        permissionId: dest.permissionId ?? '',
        droppedAt: null,
        expectedCount: copies.length,
        expectedBytes: bytes,
        expectedChangedAt: now,
      }
      return database
        .insert(volume)
        .values({ id: dest.volumeId, albumId, ...values })
        .onConflictDoUpdate({ target: volume.id, set: values })
    })
    const committed = live.length
      ? await database
          .select({ id: volume.id })
          .from(volume)
          .where(
            and(
              inArray(
                volume.id,
                live.map((v) => v.volumeId)
              ),
              isNull(volume.droppedAt)
            )
          )
          .get()
      : undefined
    if (committed) {
      await clearOffloadPending(albumId)
      await afterMove(albumId, albumRow.driveFolderId)
      return { ok: true, done: true }
    }
    await database.batch([
      database
        .update(volume)
        .set({ droppedAt: now })
        .where(
          and(
            eq(volume.albumId, albumId),
            isNull(volume.flamekeeperUserId),
            isNull(volume.droppedAt)
          )
        ),
      ...statements,
      database
        .update(album)
        .set({ rescuedAt: null, updatedAt: now })
        .where(eq(album.id, albumId)),
      ...[...added].map(([userId, bytes]) =>
        database
          .update(flamekeeper)
          .set({
            usedBytes: sql`${flamekeeper.usedBytes} + ${bytes}`,
            driveUsageBytes: sql`${flamekeeper.driveUsageBytes} + ${bytes}`,
            updatedAt: now,
          })
          .where(eq(flamekeeper.userId, userId))
      ),
    ] as unknown as Parameters<typeof database.batch>[0])
    await clearOffloadPending(albumId)
    await syncKeepingStates(database, [...added.keys()])
    await afterMove(albumId, albumRow.driveFolderId)
    try {
      await cleanDroppedVolumes(database, budget, {
        albumId,
        minAgeMs: 0,
        now,
      })
    } catch (error) {
      console.warn(`Could not clean up after offloading ${albumId}:`, error)
    }
    return { ok: true, done: true }
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
