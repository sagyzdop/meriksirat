import { VOLUME_MAX_BYTES, packFiles, splitBytes } from './volume-limit'
import type { AlbumStorageHolder } from './status'

export type MoveTarget = 'buffer' | 'flamekeeper'

export interface PlacementCandidate {
  userId: string
  name?: string
  freeBytes: number
}

export interface MoveAlbumInput {
  albumId: string
  title: string
  bytes: number
  holder: AlbumStorageHolder
  deleted?: boolean
}

export interface MovePreviewItem {
  albumId: string
  title: string
  from: AlbumStorageHolder
  to: MoveTarget
  bytes: number
  flamekeeperUserId?: string
  flamekeeperName?: string
  volumes?: { userId: string; name?: string; bytes: number }[]
  skipReason?: string
}

export interface MovePreviewCounts {
  selected: number
  onBuffer: number
  onFlamekeeper: number
  unknown: number
  movable: number
  skipped: number
}

export interface MovePreview {
  items: MovePreviewItem[]
  counts: MovePreviewCounts
}

export function pickFlamekeeper(
  bytes: number,
  candidates: PlacementCandidate[]
): PlacementCandidate | null {
  let best: PlacementCandidate | null = null
  for (const c of candidates) {
    if (c.freeBytes < bytes) continue
    if (
      !best ||
      c.freeBytes > best.freeBytes ||
      (c.freeBytes === best.freeBytes && c.userId < best.userId)
    ) {
      best = c
    }
  }
  return best
}

export function assignVolumes(
  volumeBytes: number[],
  candidates: PlacementCandidate[]
): PlacementCandidate[] | null {
  const free = new Map(candidates.map((c) => [c.userId, c.freeBytes]))
  const picks: PlacementCandidate[] = []
  for (const bytes of volumeBytes) {
    const pick = pickFlamekeeper(
      bytes,
      candidates.map((c) => ({ ...c, freeBytes: free.get(c.userId) ?? 0 }))
    )
    if (!pick) return null
    picks.push(pick)
    free.set(pick.userId, (free.get(pick.userId) ?? 0) - bytes)
  }
  return picks
}

export function planMoves(input: {
  albums: MoveAlbumInput[]
  target: MoveTarget
  candidates: PlacementCandidate[]
}): MovePreview {
  const free = new Map(input.candidates.map((c) => [c.userId, c.freeBytes]))
  const items: MovePreviewItem[] = []
  const counts: MovePreviewCounts = {
    selected: input.albums.length,
    onBuffer: 0,
    onFlamekeeper: 0,
    unknown: 0,
    movable: 0,
    skipped: 0,
  }

  for (const a of input.albums) {
    if (a.holder === 'buffer') counts.onBuffer++
    else if (a.holder === 'flamekeeper') counts.onFlamekeeper++
    else counts.unknown++

    const item: MovePreviewItem = {
      albumId: a.albumId,
      title: a.title,
      from: a.holder,
      to: input.target,
      bytes: a.bytes,
    }
    if (a.deleted) item.skipReason = 'Album was deleted'
    else if (a.holder === 'none') item.skipReason = 'No storage record'
    else if (input.target === 'buffer' && a.holder === 'buffer') {
      item.skipReason = 'Already on the buffer'
    } else if (input.target === 'flamekeeper' && a.holder === 'flamekeeper') {
      item.skipReason = 'Already on a flamekeeper'
    } else if (input.target === 'flamekeeper') {
      const sizes = splitBytes(a.bytes)
      const picks = assignVolumes(
        sizes,
        input.candidates.map((c) => ({
          ...c,
          freeBytes: free.get(c.userId) ?? 0,
        }))
      )
      if (!picks) item.skipReason = 'No flamekeeper has room'
      else {
        item.flamekeeperUserId = picks[0].userId
        item.flamekeeperName = picks[0].name
        item.volumes = picks.map((p, i) => ({
          userId: p.userId,
          name: p.name,
          bytes: sizes[i],
        }))
        for (const [i, p] of picks.entries()) {
          free.set(p.userId, (free.get(p.userId) ?? 0) - sizes[i])
        }
      }
    }

    if (item.skipReason) counts.skipped++
    else counts.movable++
    items.push(item)
  }
  return { items, counts }
}

export interface FileIdentity {
  id: string
  name: string
  size: number
  md5: string
}

export interface FileMatch {
  pairs: { source: FileIdentity; copy: FileIdentity }[]
  missing: FileIdentity[]
}

export function matchFiles(
  source: FileIdentity[],
  copies: FileIdentity[]
): FileMatch {
  const pool = new Map<string, FileIdentity[]>()
  for (const c of copies) {
    const key = `${c.md5}:${c.size}:${c.name}`
    pool.set(key, [...(pool.get(key) ?? []), c])
  }
  const pairs: FileMatch['pairs'] = []
  const missing: FileIdentity[] = []
  for (const s of source) {
    const copy = pool.get(`${s.md5}:${s.size}:${s.name}`)?.shift()
    if (copy) pairs.push({ source: s, copy })
    else missing.push(s)
  }
  return { pairs, missing }
}

export function verifyCopy(
  source: FileIdentity[],
  copies: FileIdentity[]
): { ok: boolean; reason?: string } {
  if (copies.length < source.length) {
    return { ok: false, reason: 'Some files were not copied' }
  }
  const sourceBytes = source.reduce((n, f) => n + f.size, 0)
  const match = matchFiles(source, copies)
  if (match.missing.length > 0) {
    return { ok: false, reason: 'A copied file did not match its original' }
  }
  const matchedBytes = match.pairs.reduce((n, p) => n + p.copy.size, 0)
  if (matchedBytes !== sourceBytes) {
    return { ok: false, reason: 'Copied size differs from the original' }
  }
  return { ok: true }
}

export function bufferHasRoom(
  usedBytes: number,
  limitBytes: number | null,
  incomingBytes: number
): boolean {
  if (limitBytes === null) return true
  return usedBytes + incomingBytes <= limitBytes
}

export function deletionDate(now: Date, noticeDays: number): Date {
  return new Date(now.getTime() + noticeDays * 24 * 60 * 60 * 1000)
}

export function deletionRecipients(
  ownerUserId: string,
  favoriterUserIds: string[]
): string[] {
  return [...new Set([ownerUserId, ...favoriterUserIds])]
}

export function deletionNoticeText(
  title: string,
  dateText: string,
  albumUrl?: string
): string {
  const link = albumUrl ? `\n${albumUrl}` : ''
  return `The album "${title}" is scheduled for deletion on ${dateText}. Download any photos you want to keep before then.${link}`
}

export interface OffloadPendingFile extends FileIdentity {
  mimeType: string
  sourceFolderId: string
}

export interface OffloadCopy {
  sourceId: string
  copyId: string
  size: number
}

export interface OffloadPendingVolume {
  volumeId: string
  destUserId: string
  volumeFolderId: string | null
  permissionId: string | null
  bytes: number
  files: OffloadPendingFile[]
  copies?: OffloadCopy[]
  extras?: string[]
}

export interface OffloadPending {
  startedAt: number
  sourceFolders: string[]
  checkedFolders: string[]
  goneSources?: string[]
  volumes: OffloadPendingVolume[]
}

export interface OffloadStart {
  albumId: string
  files: FileIdentity[]
  downloadToken: string
}

export interface OffloadMint {
  urls: Record<string, string>
  uploaded: string[]
  downloadToken: string
}

export type OffloadCompletion =
  { ok: true; done: boolean } | { ok: false; reason: string }

export function planOffloadVolumes<T extends { size: number }>(
  files: T[],
  candidates: PlacementCandidate[],
  max: number = VOLUME_MAX_BYTES
): { files: T[]; bytes: number; userId: string }[] | null {
  const groups = packFiles(files, max)
  const sizes = groups.map((g) => g.reduce((n, f) => n + f.size, 0))
  const picks = assignVolumes(sizes, candidates)
  if (!picks) return null
  return groups.map((group, i) => ({
    files: group,
    bytes: sizes[i],
    userId: picks[i].userId,
  }))
}

export function canReusePending(
  pending: OffloadPending,
  sourceIds: string[],
  free: Map<string, number>
): boolean {
  const ids = new Set(pending.volumes.flatMap((v) => v.files.map((f) => f.id)))
  if (sourceIds.length === 0) return false
  if (!sourceIds.every((id) => ids.has(id))) return false
  const need = new Map<string, number>()
  for (const v of pending.volumes) {
    need.set(v.destUserId, (need.get(v.destUserId) ?? 0) + v.bytes)
  }
  return [...need].every(([userId, bytes]) => (free.get(userId) ?? 0) >= bytes)
}

export function trimPending(
  pending: OffloadPending,
  sourceIds: string[]
): OffloadPending {
  const keep = new Set(sourceIds)
  return {
    ...pending,
    volumes: pending.volumes.map((v) => {
      const files = v.files.filter((f) => keep.has(f.id))
      return {
        ...v,
        files,
        bytes: files.reduce((n, f) => n + f.size, 0),
        copies: undefined,
        extras: undefined,
      }
    }),
  }
}

export function unknownSourceFiles(
  pending: OffloadPending,
  listedIds: string[]
): string[] {
  const known = new Set(
    pending.volumes.flatMap((v) => v.files.map((f) => f.id))
  )
  return listedIds.filter((id) => !known.has(id))
}

export function matchVolumeCopies(
  files: FileIdentity[],
  listed: FileIdentity[]
): { copies: OffloadCopy[]; extras: string[]; missing: FileIdentity[] } {
  const match = matchFiles(files, listed)
  const used = new Set(match.pairs.map((p) => p.copy.id))
  return {
    copies: match.pairs.map((p) => ({
      sourceId: p.source.id,
      copyId: p.copy.id,
      size: p.copy.size,
    })),
    extras: listed.filter((f) => !used.has(f.id)).map((f) => f.id),
    missing: match.missing,
  }
}

export type OffloadStep =
  | { kind: 'check-source'; folderId: string }
  | { kind: 'verify'; volumeId: string }
  | { kind: 'commit' }

export function nextOffloadStep(pending: OffloadPending): OffloadStep {
  const volume = pending.volumes.find((v) => !v.copies)
  if (volume) return { kind: 'verify', volumeId: volume.volumeId }
  const checked = new Set(pending.checkedFolders)
  const folderId = pending.sourceFolders.find((id) => !checked.has(id))
  if (folderId) return { kind: 'check-source', folderId }
  return { kind: 'commit' }
}

export function goneFromSource(
  pending: OffloadPending,
  folderId: string,
  listedIds: string[]
): string[] {
  const listed = new Set(listedIds)
  return pending.volumes.flatMap((v) =>
    v.files
      .filter((f) => f.sourceFolderId === folderId && !listed.has(f.id))
      .map((f) => f.id)
  )
}

export function offloadCopiesToKeep(
  volume: OffloadPendingVolume,
  gone: Set<string>
): { keep: OffloadCopy[]; drop: string[] } {
  const copies = volume.copies ?? []
  return {
    keep: copies.filter((c) => !gone.has(c.sourceId)),
    drop: [
      ...(volume.extras ?? []),
      ...copies.filter((c) => gone.has(c.sourceId)).map((c) => c.copyId),
    ],
  }
}

export type DrainStep =
  | { kind: 'finalize' }
  | { kind: 'pause'; alert: 'buffer_full' }
  | { kind: 'rescue' }

export function planDrainStep(input: {
  heldVolumes: number
  bufferFull: boolean
}): DrainStep {
  if (input.heldVolumes === 0) return { kind: 'finalize' }
  if (input.bufferFull) return { kind: 'pause', alert: 'buffer_full' }
  return { kind: 'rescue' }
}
