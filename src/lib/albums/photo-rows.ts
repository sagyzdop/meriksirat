import type { DriveFolderState } from '@/lib/google/google-drive'
import type {
  AlbumListingEntry,
  CachedSource,
  ListingFile,
  ListingStatus,
} from './listing'

export interface PhotoSourceRow {
  key: string
  folderId: string
  stamp: string
  status: ListingStatus
  listedAt: number | null
  failedAt: number | null
}

export interface PhotoRow {
  sourceKey: string
  meta: string
}

function parseFile(meta: string): ListingFile | null {
  try {
    const file = JSON.parse(meta) as ListingFile | null
    return file && typeof file.id === 'string' ? file : null
  } catch {
    return null
  }
}

/** The stored rows of one album as the listing entry the views read. */
export function buildListingEntry(
  folderState: DriveFolderState,
  sources: PhotoSourceRow[],
  photos: PhotoRow[]
): AlbumListingEntry | null {
  if (sources.length === 0) return null
  const files = new Map<string, ListingFile[]>()
  for (const row of photos) {
    const file = parseFile(row.meta)
    if (!file) continue
    const list = files.get(row.sourceKey)
    if (list) list.push(file)
    else files.set(row.sourceKey, [file])
  }
  const entry: AlbumListingEntry = { folderState, sources: {} }
  for (const source of sources) {
    entry.sources[source.key] = {
      folderId: source.folderId,
      stamp: source.stamp,
      status: source.status,
      listedAt: source.listedAt,
      failedAt: source.failedAt,
      files: files.get(source.key) ?? [],
    }
  }
  return entry
}

export interface ListingSavePlan {
  folderState: DriveFolderState | null
  dropSources: string[]
  putSources: PhotoSourceRow[]
  replaceFiles: { key: string; files: ListingFile[] }[]
}

function sameSource(a: CachedSource, b: CachedSource): boolean {
  return (
    a.folderId === b.folderId &&
    a.stamp === b.stamp &&
    a.status === b.status &&
    a.listedAt === b.listedAt &&
    a.failedAt === b.failedAt
  )
}

function sameFiles(a: ListingFile[], b: ListingFile[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/** The row writes that turn the stored `previous` entry into `next`. */
export function planListingSave(
  previous: AlbumListingEntry | null,
  next: AlbumListingEntry
): ListingSavePlan {
  const plan: ListingSavePlan = {
    folderState:
      previous?.folderState === next.folderState ? null : next.folderState,
    dropSources: Object.keys(previous?.sources ?? {}).filter(
      (key) => !Object.hasOwn(next.sources, key)
    ),
    putSources: [],
    replaceFiles: [],
  }
  for (const [key, source] of Object.entries(next.sources)) {
    const before = previous?.sources[key]
    if (!before || !sameSource(before, source)) {
      plan.putSources.push({
        key,
        folderId: source.folderId,
        stamp: source.stamp,
        status: source.status,
        listedAt: source.listedAt,
        failedAt: source.failedAt,
      })
    }
    if (!before || !sameFiles(before.files, source.files)) {
      plan.replaceFiles.push({ key, files: source.files })
    }
  }
  return plan
}

export function isEmptySavePlan(plan: ListingSavePlan): boolean {
  return (
    plan.folderState === null &&
    plan.dropSources.length === 0 &&
    plan.putSources.length === 0 &&
    plan.replaceFiles.length === 0
  )
}

export function chunkFiles<T>(files: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < files.length; i += size) {
    chunks.push(files.slice(i, i + size))
  }
  return chunks
}
