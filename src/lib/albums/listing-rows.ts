import type { DriveFolderState } from '@/lib/google/google-drive'
import type {
  AlbumListingEntry,
  CachedSource,
  ListingFile,
  ListingStatus,
} from './listing'

export interface ListingRow {
  key: string
  folderId: string
  stamp: string
  status: ListingStatus
  listedAt: number | null
  failedAt: number | null
  files: string
}

function parseFiles(raw: string): ListingFile[] | null {
  try {
    const files: unknown = JSON.parse(raw)
    if (!Array.isArray(files)) return null
    return files.filter(
      (f): f is ListingFile => !!f && typeof f.id === 'string'
    )
  } catch {
    return null
  }
}

/**
 * The stored rows of one album as the listing entry the views read. A row
 * whose files cannot be read is left out, so that folder is listed again.
 */
export function buildListingEntry(
  folderState: DriveFolderState,
  rows: ListingRow[]
): AlbumListingEntry | null {
  const entry: AlbumListingEntry = { folderState, sources: {} }
  for (const row of rows) {
    const files = parseFiles(row.files)
    if (!files) continue
    entry.sources[row.key] = {
      folderId: row.folderId,
      stamp: row.stamp,
      status: row.status,
      listedAt: row.listedAt,
      failedAt: row.failedAt,
      files,
    }
  }
  return Object.keys(entry.sources).length > 0 ? entry : null
}

export interface ListingSavePlan {
  folderState: DriveFolderState | null
  drop: string[]
  // `files` is null when the listed files did not change, so only the small
  // columns are written.
  put: (Omit<ListingRow, 'files'> & { files: string | null })[]
}

function sameState(a: CachedSource, b: CachedSource): boolean {
  return (
    a.folderId === b.folderId &&
    a.stamp === b.stamp &&
    a.status === b.status &&
    a.listedAt === b.listedAt &&
    a.failedAt === b.failedAt
  )
}

/** The row writes that turn the stored `previous` entry into `next`. */
export function planListingSave(
  previous: AlbumListingEntry | null,
  next: AlbumListingEntry
): ListingSavePlan {
  const plan: ListingSavePlan = {
    folderState:
      previous?.folderState === next.folderState ? null : next.folderState,
    drop: Object.keys(previous?.sources ?? {}).filter(
      (key) => !Object.hasOwn(next.sources, key)
    ),
    put: [],
  }
  for (const [key, source] of Object.entries(next.sources)) {
    const before = previous?.sources[key]
    const same = before?.files === source.files
    const files = same ? null : JSON.stringify(source.files)
    const filesChanged =
      !before || (!same && JSON.stringify(before.files) !== files)
    if (before && !filesChanged && sameState(before, source)) continue
    plan.put.push({
      key,
      folderId: source.folderId,
      stamp: source.stamp,
      status: source.status,
      listedAt: source.listedAt,
      failedAt: source.failedAt,
      files: filesChanged ? files : null,
    })
  }
  return plan
}

export function isEmptySavePlan(plan: ListingSavePlan): boolean {
  return (
    plan.folderState === null && plan.drop.length === 0 && plan.put.length === 0
  )
}
