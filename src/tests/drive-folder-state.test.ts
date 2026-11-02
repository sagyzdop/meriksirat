import { afterEach, describe, expect, it, vi } from 'vitest'
import { DriveAuthError, getDriveFolderState } from '@/lib/google/google-drive'
import { folderCheckVerdict } from '@/lib/albums/recreate'

function stubFetch(response: Response | Error) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (response instanceof Error) throw response
      return response
    })
  )
}

async function verdictFor(response: Response | Error) {
  stubFetch(response)
  try {
    return folderCheckVerdict({
      state: await getDriveFolderState('token', 'folder'),
    })
  } catch (error) {
    return folderCheckVerdict({ error })
  }
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

describe('recreate check end to end', () => {
  it('lets the recreate proceed only for a 404', async () => {
    expect(await verdictFor(new Response('{}', { status: 404 }))).toBe(
      'missing'
    )
  })

  it.each([
    ['live folder', Response.json({ id: 'f' }), 'exists'],
    ['trashed folder', Response.json({ trashed: true }), 'exists'],
    ['401', new Response('{}', { status: 401 }), 'unknown'],
    ['403', new Response('{}', { status: 403 }), 'unknown'],
    ['500', new Response('{}', { status: 500 }), 'unknown'],
    ['network failure', new TypeError('fetch failed'), 'unknown'],
  ] as const)('stops without deleting on %s', async (_label, res, expected) => {
    expect(await verdictFor(res)).toBe(expected)
  })
})
