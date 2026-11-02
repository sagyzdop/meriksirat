import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DriveAuthError,
  batchDeleteDriveFiles,
} from '@/lib/google/google-drive'

function part(index: number, status: string): string {
  return [
    '--batch_x',
    'Content-Type: application/http',
    `Content-ID: <response-${index}>`,
    '',
    `HTTP/1.1 ${status}`,
    '',
    '{}',
  ].join('\r\n')
}

function stubBatch(...parts: string[]) {
  const body = [...parts, '--batch_x--'].join('\r\n')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status: 200 }))
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('batchDeleteDriveFiles', () => {
  it('returns only files that failed, in order', async () => {
    stubBatch(
      part(0, '204 No Content'),
      part(1, '404 Not Found'),
      part(2, '403 Forbidden'),
      part(3, '500 Internal Server Error')
    )
    expect(await batchDeleteDriveFiles('t', ['a', 'b', 'c', 'd'])).toEqual([
      'c',
      'd',
    ])
  })

  it('counts a file with no response part as failed', async () => {
    stubBatch(part(0, '204 No Content'))
    expect(await batchDeleteDriveFiles('t', ['a', 'b'])).toEqual(['b'])
  })

  it('throws DriveAuthError when a part is a 401', async () => {
    stubBatch(part(0, '204 No Content'), part(1, '401 Unauthorized'))
    await expect(batchDeleteDriveFiles('t', ['a', 'b'])).rejects.toBeInstanceOf(
      DriveAuthError
    )
  })
})
