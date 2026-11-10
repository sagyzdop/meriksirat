import { describe, expect, it } from 'vitest'
import type {
  AlbumListingEntry,
  CachedSource,
  ListingFile,
} from '@/lib/albums/listing'
import {
  buildListingEntry,
  isEmptySavePlan,
  planListingSave,
} from '@/lib/albums/listing-rows'

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

function row(key: string, files: ListingFile[] | string) {
  const { files: _files, ...state } = source([])
  return {
    key,
    ...state,
    files: typeof files === 'string' ? files : JSON.stringify(files),
  }
}

function entry(sources: Record<string, CachedSource>): AlbumListingEntry {
  return { folderState: 'ok', sources }
}

describe('reading stored listings', () => {
  it('is empty until a folder has been listed', () => {
    expect(buildListingEntry('ok', [])).toBeNull()
  })

  it('reads each folder with its files in stored order', () => {
    const built = buildListingEntry('trashed', [
      row('buffer:v1', [file('b'), file('a')]),
      row('master', [file('m')]),
    ])
    expect(built?.folderState).toBe('trashed')
    expect(built?.sources['buffer:v1'].files.map((f) => f.id)).toEqual([
      'b',
      'a',
    ])
    expect(built?.sources.master.files.map((f) => f.id)).toEqual(['m'])
    expect(built?.sources.master.stamp).toBe('1:100')
  })

  it('leaves out a folder whose files cannot be read, so it is listed again', () => {
    const built = buildListingEntry('ok', [
      row('buffer:v1', 'not json'),
      row('buffer:v2', '{"not":"an array"}'),
      row('master', [file('m')]),
    ])
    expect(Object.keys(built?.sources ?? {})).toEqual(['master'])
    expect(buildListingEntry('ok', [row('buffer:v1', 'not json')])).toBeNull()
  })
})

describe('planning what a listing changes in storage', () => {
  it('writes every folder on the first listing', () => {
    const next = entry({ 'buffer:v1': source([file('a')]) })
    const plan = planListingSave(null, next)
    expect(plan.folderState).toBe('ok')
    expect(plan.put).toHaveLength(1)
    expect(plan.put[0].key).toBe('buffer:v1')
    expect(plan.put[0].files).toBe(JSON.stringify([file('a')]))
  })

  it('writes nothing when a listing found no change', () => {
    const before = entry({ 'buffer:v1': source([file('a')]) })
    const after = entry({ 'buffer:v1': source([file('a')]) })
    expect(isEmptySavePlan(planListingSave(before, after))).toBe(true)
  })

  it('leaves the files alone when the same photos were listed again', () => {
    const before = entry({ 'buffer:v1': source([file('a')]) })
    const after = entry({
      'buffer:v1': source([file('a')], { listedAt: 2000 }),
    })
    const plan = planListingSave(before, after)
    expect(plan.put).toHaveLength(1)
    expect(plan.put[0].listedAt).toBe(2000)
    expect(plan.put[0].files).toBeNull()
  })

  it('rewrites only the folder whose files changed', () => {
    const before = entry({
      'buffer:v1': source([file('a')]),
      master: source([file('m')]),
    })
    const after = entry({
      'buffer:v1': source([file('a'), file('b')]),
      master: before.sources.master,
    })
    const plan = planListingSave(before, after)
    expect(plan.put.map((p) => p.key)).toEqual(['buffer:v1'])
    expect(plan.put[0].files).toBe(JSON.stringify([file('a'), file('b')]))
  })

  it('drops a folder the album no longer has', () => {
    const before = entry({
      'buffer:v1': source([file('a')]),
      'flamekeeper:v2': source([file('f')]),
    })
    const after = entry({ 'buffer:v1': before.sources['buffer:v1'] })
    const plan = planListingSave(before, after)
    expect(plan.drop).toEqual(['flamekeeper:v2'])
    expect(plan.put).toEqual([])
  })

  it('records a changed folder state', () => {
    const before = entry({ 'buffer:v1': source([]) })
    const after = { ...before, folderState: 'missing' as const }
    expect(planListingSave(before, after).folderState).toBe('missing')
  })
})
