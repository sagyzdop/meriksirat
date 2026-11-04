import { afterEach, describe, expect, it, vi } from 'vitest'
import { listDriveFolderUpTo } from '@/lib/google/google-drive'

function stubPages(pages: number, perPage: number) {
  let served = 0
  const fetchMock = vi.fn(async () => {
    const page = served++
    return new Response(
      JSON.stringify({
        files: Array.from({ length: perPage }, (_, i) => ({
          id: `p${page}-${i}`,
          name: 'a.jpg',
          mimeType: 'image/jpeg',
        })),
        ...(page + 1 < pages ? { nextPageToken: `t${page + 1}` } : {}),
      }),
      { status: 200 }
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('listDriveFolderUpTo', () => {
  it('follows every page, past the old 2,000-photo limit', async () => {
    stubPages(3, 1000)
    const result = await listDriveFolderUpTo('token', 'folder', () => true)
    expect(result.files).toHaveLength(3000)
    expect(result.complete).toBe(true)
  })

  it('returns what it has and says so when it may not make another request', async () => {
    const fetchMock = stubPages(3, 1000)
    let allowed = 2
    const result = await listDriveFolderUpTo(
      'token',
      'folder',
      () => allowed-- > 0
    )
    expect(result.files).toHaveLength(2000)
    expect(result.complete).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('asks Drive for the checksum dedupe needs', async () => {
    const fetchMock = stubPages(1, 1)
    await listDriveFolderUpTo('token', 'folder', () => true)
    const calls = fetchMock.mock.calls as unknown as [string][]
    expect(decodeURIComponent(calls[0][0])).toContain('md5Checksum')
  })

  it('raises Drive errors for the caller to classify', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 404 }))
    )
    await expect(
      listDriveFolderUpTo('token', 'folder', () => true)
    ).rejects.toThrow('Drive file not found')
  })
})
