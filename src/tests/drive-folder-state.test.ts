import { afterEach, describe, expect, it, vi } from 'vitest'
import { DriveAuthError, getDriveFolderState } from '@/lib/google/google-drive'

function stubFetch(response: Response | Error) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (response instanceof Error) throw response
      return response
    })
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('getDriveFolderState', () => {
  it('reports ok for a live folder', async () => {
    stubFetch(Response.json({ id: 'folder' }))
    expect(await getDriveFolderState('token', 'folder')).toBe('ok')
  })

  it('reports trashed for a folder in the bin', async () => {
    stubFetch(Response.json({ id: 'folder', trashed: true }))
    expect(await getDriveFolderState('token', 'folder')).toBe('trashed')
  })

  it('reports missing for a 404', async () => {
    stubFetch(new Response('{}', { status: 404 }))
    expect(await getDriveFolderState('token', 'folder')).toBe('missing')
  })

  it('throws on an auth failure instead of reporting missing', async () => {
    stubFetch(new Response('{}', { status: 401 }))
    await expect(getDriveFolderState('token', 'folder')).rejects.toBeInstanceOf(
      DriveAuthError
    )
  })
})
