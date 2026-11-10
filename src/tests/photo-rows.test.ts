import { describe, expect, it } from 'vitest'
import type {
  AlbumListingEntry,
  CachedSource,
  ListingFile,
} from '@/lib/albums/listing'
import {
  buildListingEntry,
  chunkFiles,
  isEmptySavePlan,
  planListingSave,
} from '@/lib/albums/photo-rows'

function file(id: string, size = 100): ListingFile {
  return { id, name: `${id}.jpg`, mimeType: 'image/jpeg', size: String(size) }
}

function source(files: ListingFile[], over: Partial<CachedSource> = {}) {
  return {
    folderId: 'folder',
    stamp: '1:100',
    status: 'ok' as const,
    listedAt: 1000,
    failedAt: null,
    files,
    ...over,
  }
}

function entry(sources: Record<string, CachedSource>): AlbumListingEntry {
  return { folderState: 'ok', sources }
}

describe('reading stored photo rows', () => {
  it('is empty until a source has been listed', () => {
    expect(buildListingEntry('ok', [], [])).toBeNull()
  })

  it('groups photos under their source in stored order', () => {
    const built = buildListingEntry(
      'trashed',
      [
        { key: 'buffer', ...source([]), files: undefined } as never,
        { key: 'master', ...source([]), files: undefined } as never,
      ],
      [
        { sourceKey: 'buffer', meta: JSON.stringify(file('b')) },
        { sourceKey: 'master', meta: JSON.stringify(file('m')) },
        { sourceKey: 'buffer', meta: JSON.stringify(file('a')) },
      ]
    )
    expect(built?.folderState).toBe('trashed')
    expect(built?.sources.buffer.files.map((f) => f.id)).toEqual(['b', 'a'])
    expect(built?.sources.master.files.map((f) => f.id)).toEqual(['m'])
  })

  it('skips unreadable rows and rows of a source that is gone', () => {
    const built = buildListingEntry(
      'ok',
      [{ key: 'buffer', ...source([]) }],
      [
        { sourceKey: 'buffer', meta: 'not json' },
        { sourceKey: 'flamekeeper:old', meta: JSON.stringify(file('x')) },
      ]
    )
    expect(built?.sources.buffer.files).toEqual([])
    expect(Object.keys(built?.sources ?? {})).toEqual(['buffer'])
  })
})

describe('planning what a listing changes in the table', () => {
  it('writes everything on the first listing', () => {
    const next = entry({ buffer: source([file('a')]) })
    const plan = planListingSave(null, next)
    expect(plan.folderState).toBe('ok')
    expect(plan.putSources.map((s) => s.key)).toEqual(['buffer'])
    expect(plan.replaceFiles).toEqual([{ key: 'buffer', files: [file('a')] }])
  })

  it('writes nothing when a listing found no change', () => {
    const before = entry({ buffer: source([file('a')]) })
    const after = entry({ buffer: source([file('a')]) })
    expect(isEmptySavePlan(planListingSave(before, after))).toBe(true)
  })

  it('updates only the source row when the same photos were listed again', () => {
    const before = entry({ buffer: source([file('a')]) })
    const after = entry({ buffer: source([file('a')], { listedAt: 2000 }) })
    const plan = planListingSave(before, after)
    expect(plan.putSources.map((s) => s.listedAt)).toEqual([2000])
    expect(plan.replaceFiles).toEqual([])
  })

  it('replaces the photos of a source whose files changed', () => {
    const before = entry({
      buffer: source([file('a')]),
      master: source([file('m')]),
    })
    const after = entry({
      buffer: source([file('a'), file('b')]),
      master: before.sources.master,
    })
    const plan = planListingSave(before, after)
    expect(plan.replaceFiles.map((r) => r.key)).toEqual(['buffer'])
    expect(plan.putSources).toEqual([])
  })

  it('drops a source the album no longer has', () => {
    const before = entry({
      buffer: source([file('a')]),
      'flamekeeper:v1': source([file('f')]),
    })
    const after = entry({ buffer: before.sources.buffer })
    const plan = planListingSave(before, after)
    expect(plan.dropSources).toEqual(['flamekeeper:v1'])
  })

  it('records a changed folder state', () => {
    const before = entry({ buffer: source([]) })
    const after = { ...before, folderState: 'missing' as const }
    expect(planListingSave(before, after).folderState).toBe('missing')
  })
})

describe('chunkFiles', () => {
  it('splits into chunks of the given size', () => {
    expect(chunkFiles([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunkFiles([], 2)).toEqual([])
  })
})
