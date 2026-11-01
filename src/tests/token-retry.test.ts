import { describe, expect, it, vi } from 'vitest'
import { DriveAuthError, driveErrorFor } from '@/lib/google/google-drive'
import { withTokenRetry, type TokenSource } from '@/lib/google/token-retry'

function source(overrides: Partial<TokenSource> = {}) {
  const tokens = ['stale', 'fresh', 'third']
  let i = 0
  return {
    getToken: vi.fn(async () => tokens[i++]),
    forget: vi.fn(),
    hasCached: () => true,
    canRetry: () => true,
    ...overrides,
  }
}

describe('driveErrorFor 401', () => {
  it('maps 401 to an auth error', () => {
    expect(driveErrorFor(401, 'Invalid Credentials')).toBeInstanceOf(
      DriveAuthError
    )
  })
})

describe('withTokenRetry', () => {
  it('returns the result without retrying on success', async () => {
    const src = source()
    const run = vi.fn(async (t: string) => t)
    expect(await withTokenRetry(src, run)).toBe('stale')
    expect(src.forget).not.toHaveBeenCalled()
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('forgets the token and retries once on a 401', async () => {
    const src = source()
    const run = vi.fn(async (t: string) => {
      if (t === 'stale') throw new DriveAuthError()
      return t
    })
    expect(await withTokenRetry(src, run)).toBe('fresh')
    expect(src.forget).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('does not loop on a second 401', async () => {
    const src = source()
    const run = vi.fn(async () => {
      throw new DriveAuthError()
    })
    await expect(withTokenRetry(src, run)).rejects.toBeInstanceOf(
      DriveAuthError
    )
    expect(run).toHaveBeenCalledTimes(2)
    expect(src.getToken).toHaveBeenCalledTimes(2)
  })

  it('does not retry other errors', async () => {
    const src = source()
    const run = vi.fn(async () => {
      throw new Error('boom')
    })
    await expect(withTokenRetry(src, run)).rejects.toThrow('boom')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('does not retry when the token was not cached', async () => {
    const src = source({ hasCached: () => false })
    const run = vi.fn(async () => {
      throw new DriveAuthError()
    })
    await expect(withTokenRetry(src, run)).rejects.toBeInstanceOf(
      DriveAuthError
    )
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('does not retry when the budget cannot afford it', async () => {
    const src = source({ canRetry: () => false })
    const run = vi.fn(async () => {
      throw new DriveAuthError()
    })
    await expect(withTokenRetry(src, run)).rejects.toBeInstanceOf(
      DriveAuthError
    )
    expect(run).toHaveBeenCalledTimes(1)
    expect(src.forget).not.toHaveBeenCalled()
  })

  it('surfaces a failing refresh on retry', async () => {
    const getToken = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('stale')
      .mockRejectedValueOnce(new Error('invalid_grant'))
    const run = vi.fn(async () => {
      throw new DriveAuthError()
    })
    await expect(
      withTokenRetry(
        {
          getToken,
          forget: vi.fn(),
          hasCached: () => true,
          canRetry: () => true,
        },
        run
      )
    ).rejects.toThrow('invalid_grant')
    expect(run).toHaveBeenCalledTimes(1)
  })
})
