import { RUN_SUBREQUEST_BUDGET } from '@/lib/cron/budget'
import { DriveNotFoundError } from '@/lib/google/google-drive'
import type { DriveFileMeta, DriveFolderState } from '@/lib/google/google-drive'
import {
  driveFileToAlbumPhoto,
  isImage,
  sortPhotosByCapture,
} from './drive-photo'
import type { AlbumPhoto } from './types'

// A view lists Drive again by age only when the hourly reconcile has not
// reached the album for this long.
export const LISTING_FRESH_MS = 7 * 24 * 60 * 60 * 1000
export const LISTING_RECONCILE_MS = 24 * 60 * 60 * 1000
export const LISTING_RETRY_MS = 15 * 60 * 1000
export const LISTING_STAMP_THROTTLE_MS = 5 * 60 * 1000
export const LISTING_SETTLE_MS = 30 * 1000
export const LISTING_STALE_LIMIT_MS = 7 * 24 * 60 * 60 * 1000
export const LISTING_DRIVE_BUDGET = RUN_SUBREQUEST_BUDGET

export const bufferSourceKey = (volumeId: string) => `buffer:${volumeId}`

export const flamekeeperSourceKey = (volumeId: string) =>
  `flamekeeper:${volumeId}`

export const isBufferSourceKey = (key: string) => key.startsWith('buffer:')

export function volumeIdFromSourceKey(key: string): string | null {
  for (const prefix of ['buffer:', 'flamekeeper:']) {
    if (key.startsWith(prefix)) return key.slice(prefix.length) || null
  }
  return null
}

export type ListingFile = DriveFileMeta

export type ListingOwner =
  | { kind: 'master' }
  | { kind: 'buffer'; grantId?: string | null }
  | { kind: 'flamekeeper'; userId: string }

export interface ListingSource {
  key: string
  owner: ListingOwner
  folderId: string
  stamp: string
  changedAt: number | null
  listable: boolean
  expected: { count: number; bytes: number } | null
}

export interface ListingSourcesInput {
  albumFolderId: string
  bufferVolumes: {
    id: string
    driveFolderId: string | null
    expectedCount: number | null
    expectedBytes: number | null
    expectedChangedAt?: number | null
  }[]
  flamekeeperVolumes: {
    id: string
    userId: string
    driveFolderId: string | null
    droppedAt: Date | null
    state: string | null
    hasGrant: boolean
    expectedCount?: number | null
    expectedBytes?: number | null
    expectedChangedAt?: number | null
  }[]
}

export function planListingSources(
  input: ListingSourcesInput
): ListingSource[] {
  const sources: ListingSource[] = []
  for (const more of input.bufferVolumes) {
    if (!more.driveFolderId) continue
    sources.push({
      key: bufferSourceKey(more.id),
      owner: { kind: 'buffer' },
      folderId: more.driveFolderId,
      stamp: `${more.expectedCount ?? ''}:${more.expectedBytes ?? ''}`,
      changedAt: more.expectedChangedAt ?? null,
      listable: true,
      expected:
        more.expectedCount === null || more.expectedBytes === null
          ? null
          : { count: more.expectedCount, bytes: more.expectedBytes },
    })
  }
  sources.push({
    key: 'master',
    owner: { kind: 'master' },
    folderId: input.albumFolderId,
    stamp: '',
    changedAt: null,
    listable: true,
    expected: null,
  })
  for (const v of input.flamekeeperVolumes) {
    if (!v.driveFolderId || v.droppedAt) continue
    sources.push({
      key: flamekeeperSourceKey(v.id),
      owner: { kind: 'flamekeeper', userId: v.userId },
      folderId: v.driveFolderId,
      stamp:
        v.expectedCount == null || v.expectedBytes == null
          ? ''
          : `${v.expectedCount}:${v.expectedBytes}`,
      changedAt: v.expectedChangedAt ?? null,
      listable: v.hasGrant && v.state !== 'lost' && v.state !== 'drained',
      expected:
        v.expectedCount == null || v.expectedBytes == null
          ? null
          : { count: v.expectedCount, bytes: v.expectedBytes },
    })
  }
  return sources
}

export type ListingStatus =
  'ok' | 'partial' | 'failed' | 'missing' | 'unavailable'

export interface CachedSource {
  folderId: string
  stamp: string
  status: ListingStatus
  listedAt: number | null
  failedAt: number | null
  files: ListingFile[]
}

export interface AlbumListingEntry {
  folderState: DriveFolderState
  sources: Record<string, CachedSource>
}

export type SourceAction = 'reuse' | 'list' | 'keep'

export interface ListingRefreshPlan {
  checkFolder: boolean
  actions: Record<string, SourceAction>
}

function isDue(
  source: ListingSource,
  cached: CachedSource | undefined,
  now: number,
  strictStamp: boolean
): boolean {
  if (!cached) return true
  if (cached.folderId !== source.folderId) return true
  if (cached.stamp !== source.stamp) {
    // During an upload burst every confirm changes the stamp. List again at
    // most every few minutes, or once the burst has gone quiet.
    const midBurst =
      !strictStamp &&
      cached.status === 'ok' &&
      cached.listedAt !== null &&
      source.changedAt !== null &&
      now - cached.listedAt < LISTING_STAMP_THROTTLE_MS &&
      now - source.changedAt < LISTING_SETTLE_MS
    return !midBurst
  }
  if (cached.status === 'unavailable') return true
  if (cached.failedAt !== null) {
    return now - cached.failedAt >= LISTING_RETRY_MS
  }
  if (cached.status === 'failed' || cached.listedAt === null) return true
  return now - cached.listedAt >= LISTING_FRESH_MS
}

export function planListingRefresh(input: {
  sources: ListingSource[]
  entry: AlbumListingEntry | null
  now: number
  force?: boolean
  strictStamp?: boolean
}): ListingRefreshPlan {
  const actions: Record<string, SourceAction> = {}
  for (const source of input.sources) {
    if (!source.listable) {
      actions[source.key] = 'keep'
    } else if (
      input.force ||
      isDue(
        source,
        input.entry?.sources[source.key],
        input.now,
        input.strictStamp ?? false
      )
    ) {
      actions[source.key] = 'list'
    } else {
      actions[source.key] = 'reuse'
    }
  }
  return {
    checkFolder: Object.values(actions).includes('list'),
    actions,
  }
}

export type ListingOutcome =
  | { kind: 'listed'; files: ListingFile[]; complete: boolean }
  | { kind: 'failed' }
  | { kind: 'gone' }
  | { kind: 'skipped' }

export function classifyListingError(error: unknown): 'gone' | 'failed' {
  return error instanceof DriveNotFoundError ? 'gone' : 'failed'
}

function nextSource(
  source: ListingSource,
  previous: CachedSource | null,
  outcome: ListingOutcome | undefined,
  now: number
): CachedSource {
  const base = {
    folderId: source.folderId,
    stamp: source.stamp,
    listedAt: previous?.listedAt ?? null,
    files: previous?.files ?? [],
  }
  switch (outcome?.kind) {
    case 'listed':
      return {
        ...base,
        status: outcome.complete ? 'ok' : 'partial',
        listedAt: now,
        failedAt: outcome.complete ? null : now,
        files: outcome.files,
      }
    case 'gone':
      return {
        ...base,
        status: 'missing',
        listedAt: now,
        failedAt: now,
        files: [],
      }
    case 'failed':
      return { ...base, status: 'failed', failedAt: now }
    case 'skipped':
      return { ...base, status: 'failed', failedAt: null }
    default:
      if (previous) {
        return source.listable
          ? previous
          : { ...previous, status: 'unavailable' }
      }
      return {
        ...base,
        status: source.listable ? 'failed' : 'unavailable',
        failedAt: null,
      }
  }
}

export function applyListingOutcomes(input: {
  sources: ListingSource[]
  entry: AlbumListingEntry | null
  now: number
  folderState: DriveFolderState | null
  outcomes: Record<string, ListingOutcome>
}): AlbumListingEntry {
  const folderState = input.folderState ?? input.entry?.folderState ?? 'ok'
  const sources: Record<string, CachedSource> = {}
  for (const source of input.sources) {
    if (folderState === 'missing') {
      sources[source.key] = {
        folderId: source.folderId,
        stamp: source.stamp,
        status: 'missing',
        listedAt: input.now,
        failedAt: null,
        files: [],
      }
      continue
    }
    const cached = input.entry?.sources[source.key]
    const previous = cached?.folderId === source.folderId ? cached : null
    sources[source.key] = nextSource(
      source,
      previous,
      input.outcomes[source.key],
      input.now
    )
  }
  return { folderState, sources }
}

export interface VolumeListing {
  key: string
  owner: ListingOwner
  folderId: string
  status: ListingStatus
  listedAt: number | null
  files: ListingFile[]
  count: number
  bytes: number
  expected: { count: number; bytes: number } | null
  stampStale?: boolean
}

export interface AlbumListing {
  folderState: DriveFolderState
  complete: boolean
  files: ListingFile[]
  volumes: VolumeListing[]
}

function fileBytes(file: ListingFile): number {
  return Number(file.size ?? 0) || 0
}

function readVolume(
  source: ListingSource,
  cached: CachedSource | undefined,
  now: number
): VolumeListing {
  const usable = cached?.folderId === source.folderId ? cached : undefined
  const status: ListingStatus = !source.listable
    ? 'unavailable'
    : (usable?.status ?? 'failed')
  const stale =
    status !== 'ok' &&
    (usable?.listedAt === null ||
      usable?.listedAt === undefined ||
      now - usable.listedAt > LISTING_STALE_LIMIT_MS)
  const files = stale ? [] : (usable?.files ?? []).filter(isImage)
  return {
    key: source.key,
    owner: source.owner,
    folderId: source.folderId,
    status,
    listedAt: usable?.listedAt ?? null,
    files,
    count: files.length,
    bytes: files.reduce((sum, f) => sum + fileBytes(f), 0),
    expected: source.expected,
    stampStale: !!usable && usable.stamp !== source.stamp,
  }
}

function contentKey(file: ListingFile): string | null {
  return file.md5Checksum ? `${file.size ?? ''}:${file.md5Checksum}` : null
}

export function readAlbumListing(input: {
  entry: AlbumListingEntry
  sources: ListingSource[]
  now: number
}): AlbumListing {
  const volumes = input.sources.map((source) =>
    readVolume(source, input.entry.sources[source.key], input.now)
  )
  const seen = new Set<string>()
  const files: ListingFile[] = []
  for (const volume of volumes) {
    const here: string[] = []
    for (const file of volume.files) {
      const key = contentKey(file)
      if (key && seen.has(key)) continue
      files.push(file)
      if (key) here.push(key)
    }
    for (const key of here) seen.add(key)
  }
  return {
    folderState: input.entry.folderState,
    complete:
      input.entry.folderState === 'ok' &&
      volumes.every((v) => v.status === 'ok' || v.status === 'missing'),
    files,
    volumes,
  }
}

export function listingPhotos(listing: AlbumListing): AlbumPhoto[] {
  return sortPhotosByCapture(listing.files.map(driveFileToAlbumPhoto))
}

export function findListedFile(
  listing: AlbumListing,
  fileId: string
): { owner: ListingOwner; file: ListingFile; volumeKey: string } | null {
  for (const volume of listing.volumes) {
    const file = volume.files.find((f) => f.id === fileId)
    if (file) return { owner: volume.owner, file, volumeKey: volume.key }
  }
  return null
}

export function findListedFileOwner(
  listing: AlbumListing,
  fileId: string
): ListingOwner | null {
  return findListedFile(listing, fileId)?.owner ?? null
}

export function listingTotals(
  listing: AlbumListing
): { count: number; bytes: number } | null {
  if (
    listing.folderState !== 'ok' ||
    !listing.volumes.every((v) => v.status === 'ok')
  ) {
    return null
  }
  return {
    count: listing.files.length,
    bytes: listing.files.reduce((sum, f) => sum + fileBytes(f), 0),
  }
}

export function listedMasterFiles(
  entry: AlbumListingEntry | null
): ListingFile[] | null {
  const master = entry?.sources.master
  return master?.status === 'ok' ? master.files : null
}
