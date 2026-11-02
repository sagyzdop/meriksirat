import { describe, expect, it } from 'vitest'
import {
  RECREATE_MAX_FILES,
  RECREATE_MAX_OWNERS,
  classifyDeleteError,
  classifyDeleteResult,
  folderCheckVerdict,
  isRecreatePassFinished,
  planRecreateDeletes,
  pressAgainMessage,
  recreateSummary,
  type RecreateRow,
} from '@/lib/albums/recreate'
import { DriveAuthError, DriveNotFoundError } from '@/lib/google/google-drive'
import {
  hasBatchAuthFailure,
  parseBatchResults,
  parseBatchStatuses,
} from '@/lib/google/drive-batch'

function row(id: string, owner: string | null): RecreateRow {
  return { id, driveFileId: `f-${id}`, bytes: 10, flamekeeperUserId: owner }
}

describe('folderCheckVerdict', () => {
  it('treats only a definite not-found as missing', () => {
    expect(folderCheckVerdict({ error: new DriveNotFoundError() })).toBe(
      'missing'
    )
  })

  it('treats an existing or trashed folder as not missing', () => {
    expect(folderCheckVerdict({ state: 'ok' })).toBe('exists')
    expect(folderCheckVerdict({ state: 'trashed' })).toBe('exists')
  })

  it('treats every other failure as unknown', () => {
    expect(folderCheckVerdict({ error: new DriveAuthError() })).toBe('unknown')
    expect(
      folderCheckVerdict({ error: new Error('Drive API error (500)') })
    ).toBe('unknown')
    expect(
      folderCheckVerdict({ error: new Error('Drive API error (403)') })
    ).toBe('unknown')
    expect(folderCheckVerdict({ error: new TypeError('fetch failed') })).toBe(
      'unknown'
    )
  })
})

describe('classifyDeleteResult', () => {
  it('counts success and 404 as gone', () => {
    expect(classifyDeleteResult({ status: 204, body: '' })).toBe('gone')
    expect(classifyDeleteResult({ status: 200, body: '' })).toBe('gone')
    expect(classifyDeleteResult({ status: 404, body: '' })).toBe('gone')
  })

  it('gives up on permission refusals', () => {
    const body = '{"error":{"errors":[{"reason":"forbidden"}]}}'
    expect(classifyDeleteResult({ status: 403, body })).toBe('give_up')
    expect(classifyDeleteResult({ status: 401, body: '' })).toBe('give_up')
  })

  it('retries rate limits, server errors and missing results', () => {
    const limited = '{"error":{"errors":[{"reason":"userRateLimitExceeded"}]}}'
    expect(classifyDeleteResult({ status: 403, body: limited })).toBe('retry')
    expect(
      classifyDeleteResult({
        status: 403,
        body: '{"reason":"rateLimitExceeded"}',
      })
    ).toBe('retry')
    expect(classifyDeleteResult({ status: 429, body: '' })).toBe('retry')
    expect(classifyDeleteResult({ status: 408, body: '' })).toBe('retry')
    expect(classifyDeleteResult({ status: 500, body: '' })).toBe('retry')
    expect(classifyDeleteResult({ status: 503, body: '' })).toBe('retry')
    expect(classifyDeleteResult(undefined)).toBe('retry')
  })

  it('retries every Drive limit-exceeded reason', () => {
    for (const reason of [
      'userRateLimitExceeded',
      'rateLimitExceeded',
      'dailyLimitExceeded',
    ]) {
      expect(
        classifyDeleteResult({
          status: 403,
          body: `{"error":{"errors":[{"reason":"${reason}"}]}}`,
        })
      ).toBe('retry')
    }
  })

  it('gives up on other client errors so they cannot loop forever', () => {
    expect(classifyDeleteResult({ status: 400, body: '' })).toBe('give_up')
  })
})

describe('classifyDeleteError', () => {
  it('gives up on a rejected token', () => {
    expect(classifyDeleteError(new DriveAuthError())).toBe('give_up')
  })

  it('gives up on a revoked grant but retries a transient refresh failure', () => {
    const revoked = Object.assign(new Error('revoked'), {
      name: 'FlamekeeperGrantError',
      revoked: true,
    })
    const transient = Object.assign(new Error('503'), {
      name: 'FlamekeeperGrantError',
      revoked: false,
    })
    expect(classifyDeleteError(revoked)).toBe('give_up')
    expect(classifyDeleteError(transient)).toBe('retry')
  })

  it('retries network and server failures', () => {
    expect(classifyDeleteError(new TypeError('fetch failed'))).toBe('retry')
    expect(classifyDeleteError(new Error('Drive API error (500): x'))).toBe(
      'retry'
    )
    expect(classifyDeleteError(new Error('Drive API error (429): x'))).toBe(
      'retry'
    )
  })
})

describe('planRecreateDeletes', () => {
  it('returns nothing for no rows', () => {
    expect(planRecreateDeletes([])).toEqual([])
  })

  it('groups files by owner and sends unowned files to the master', () => {
    const plan = planRecreateDeletes([
      row('1', 'a'),
      row('2', null),
      row('3', 'a'),
    ])
    expect(plan).toEqual([
      { owner: 'a', rows: [row('1', 'a'), row('3', 'a')] },
      { owner: null, rows: [row('2', null)] },
    ])
  })

  it('caps files per press', () => {
    const rows = Array.from({ length: RECREATE_MAX_FILES + 30 }, (_, i) =>
      row(String(i), 'a')
    )
    const plan = planRecreateDeletes(rows)
    expect(plan.flatMap((g) => g.rows)).toHaveLength(RECREATE_MAX_FILES)
  })

  it('caps owners per press and leaves the rest for the next one', () => {
    const rows = Array.from({ length: RECREATE_MAX_OWNERS + 3 }, (_, i) =>
      row(String(i), `u${i}`)
    )
    expect(planRecreateDeletes(rows)).toHaveLength(RECREATE_MAX_OWNERS)
  })

  it('still fills a started owner after the owner cap is reached', () => {
    const rows = [
      ...Array.from({ length: RECREATE_MAX_OWNERS }, (_, i) =>
        row(`x${i}`, `u${i}`)
      ),
      row('late', 'u0'),
    ]
    const plan = planRecreateDeletes(rows)
    expect(plan[0].rows.map((r) => r.id)).toEqual(['x0', 'late'])
  })
})

describe('isRecreatePassFinished', () => {
  it('is finished only when no rows remain', () => {
    expect(isRecreatePassFinished(0)).toBe(true)
    expect(isRecreatePassFinished(1)).toBe(false)
  })
})

describe('messages', () => {
  it('tells the user to press again with the counts so far', () => {
    const message = pressAgainMessage({ removed: 200, abandoned: 2 }, 40)
    expect(message).toContain('200')
    expect(message).toContain('40')
    expect(message).toContain('2')
    expect(message.toLowerCase()).toContain('again')
  })

  it('omits the abandoned count when none were left behind', () => {
    expect(pressAgainMessage({ removed: 5, abandoned: 0 }, 1)).not.toContain(
      "couldn't"
    )
  })

  it('summarises removed and left-behind files', () => {
    expect(recreateSummary({ removed: 3, abandoned: 0 })).toBe(
      'Album folder recreated. 3 files removed from Google Drive.'
    )
    expect(recreateSummary({ removed: 1, abandoned: 2 })).toBe(
      "Album folder recreated. 1 file removed from Google Drive. 2 files couldn't be deleted."
    )
    expect(recreateSummary({ removed: 0, abandoned: 0 })).toBe(
      'Album folder recreated.'
    )
  })
})

describe('parseBatchResults', () => {
  const part = (index: number, status: string, body: string) =>
    [
      '--batch_x',
      'Content-Type: application/http',
      `Content-ID: <response-${index}>`,
      '',
      `HTTP/1.1 ${status}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      body,
    ].join('\r\n')

  const response = [
    part(0, '204 No Content', ''),
    part(1, '403 Forbidden', '{"reason":"userRateLimitExceeded"}'),
    '--batch_x--',
  ].join('\r\n')

  it('keeps the status and body of each part', () => {
    const results = parseBatchResults(response, ['a', 'b'])
    expect(results.get('a')?.status).toBe(204)
    expect(results.get('b')?.status).toBe(403)
    expect(results.get('b')?.body).toContain('userRateLimitExceeded')
    expect(results.get('a')?.body).not.toContain('userRateLimitExceeded')
  })

  it('flags a 401 part as an auth failure', () => {
    const expired = [
      part(0, '204 No Content', ''),
      part(1, '401 Unauthorized', '{}'),
      '--batch_x--',
    ].join('\r\n')
    expect(
      hasBatchAuthFailure(parseBatchResults(expired, ['a', 'b']).values())
    ).toBe(true)
    expect(
      hasBatchAuthFailure(parseBatchResults(response, ['a', 'b']).values())
    ).toBe(false)
  })

  it('agrees with parseBatchStatuses', () => {
    expect(parseBatchStatuses(response, ['a', 'b'])).toEqual(
      new Map([
        ['a', 204],
        ['b', 403],
      ])
    )
  })
})
