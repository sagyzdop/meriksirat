import { describe, expect, it } from 'vitest'
import {
  deleteAllowance,
  planTeardown,
  settleTeardown,
} from '@/lib/albums/teardown'
import type { TeardownSource } from '@/lib/albums/teardown'

const files = (...ids: string[]) => ids.map((id) => ({ id, bytes: 10 }))
const buffer = { kind: 'buffer' } as const
const fk = (userId: string) => ({ kind: 'flamekeeper', userId }) as const

function source(
  key: string,
  owner: TeardownSource['owner'],
  reading: TeardownSource['reading']
): TeardownSource {
  return { key, owner, reading }
}

const listed = (ids: string[], complete = true) =>
  ({ kind: 'listed', files: files(...ids), complete }) as const

describe('planTeardown', () => {
  it('deletes what each owner lists, using that owner', () => {
    const plan = planTeardown(
      [
        source('buffer', buffer, listed(['a', 'b'])),
        source('flamekeeper:u1', fk('u1'), listed(['c'])),
      ],
      100
    )
    expect(plan.deletes.map((d) => [d.key, d.files.map((f) => f.id)])).toEqual([
      ['buffer', ['a', 'b']],
      ['flamekeeper:u1', ['c']],
    ])
    expect(plan.deletes[1].owner).toEqual(fk('u1'))
    expect(plan.complete).toBe(true)
  })

  it('is complete with nothing to delete when every listing is empty or the folder is gone', () => {
    const plan = planTeardown(
      [
        source('buffer', buffer, listed([])),
        source('flamekeeper:u1', fk('u1'), { kind: 'gone' }),
      ],
      100
    )
    expect(plan).toMatchObject({ deletes: [], complete: true })
  })

  it('is not complete when a listing is cut short, but still deletes what it saw', () => {
    const plan = planTeardown(
      [source('buffer', buffer, listed(['a'], false))],
      100
    )
    expect(plan.deletes).toHaveLength(1)
    expect(plan.complete).toBe(false)
  })

  it('is not complete when a listing failed or was skipped', () => {
    for (const kind of ['failed', 'skipped'] as const) {
      const plan = planTeardown(
        [
          source('buffer', buffer, { kind }),
          source('flamekeeper:u1', fk('u1'), listed(['c'])),
        ],
        100
      )
      expect(plan.complete).toBe(false)
      expect(plan.deletes.map((d) => d.key)).toEqual(['flamekeeper:u1'])
    }
  })

  it('leaves unreachable flamekeepers behind without blocking completion', () => {
    const plan = planTeardown(
      [
        source('buffer', buffer, listed(['a'])),
        source('flamekeeper:u1', fk('u1'), { kind: 'unreachable' }),
      ],
      100
    )
    expect(plan.complete).toBe(true)
    expect(plan.abandoned).toEqual(['flamekeeper:u1'])
  })

  it('caps deletes per run and is then not complete', () => {
    const plan = planTeardown(
      [
        source('buffer', buffer, listed(['a', 'b', 'c'])),
        source('flamekeeper:u1', fk('u1'), listed(['d', 'e'])),
      ],
      4
    )
    expect(plan.deletes.map((d) => d.files.length)).toEqual([3, 1])
    expect(plan.complete).toBe(false)
  })

  it('stays complete when the cap exactly covers everything', () => {
    const plan = planTeardown([source('buffer', buffer, listed(['a', 'b']))], 2)
    expect(plan.complete).toBe(true)
  })

  it('never plans a delete for a zero allowance', () => {
    const plan = planTeardown([source('buffer', buffer, listed(['a']))], 0)
    expect(plan.deletes).toEqual([])
    expect(plan.complete).toBe(false)
  })
})

describe('settleTeardown', () => {
  const plan = planTeardown([source('buffer', buffer, listed(['a', 'b']))], 100)

  it('finishes when a complete plan deleted everything', () => {
    expect(settleTeardown(plan, { buffer: { failed: 0 } })).toBe('finished')
  })

  it('retries when any delete failed or the owner call threw', () => {
    expect(settleTeardown(plan, { buffer: { failed: 1 } })).toBe('retry')
    expect(settleTeardown(plan, { buffer: { failed: 0, threw: true } })).toBe(
      'retry'
    )
    expect(settleTeardown(plan, {})).toBe('retry')
  })

  it('retries when the plan was incomplete even if every delete worked', () => {
    const partial = planTeardown(
      [source('buffer', buffer, listed(['a'], false))],
      100
    )
    expect(settleTeardown(partial, { buffer: { failed: 0 } })).toBe('retry')
  })

  it('finishes with no deletes planned and a complete plan', () => {
    const empty = planTeardown([source('buffer', buffer, listed([]))], 100)
    expect(settleTeardown(empty, {})).toBe('finished')
  })
})

describe('deleteAllowance', () => {
  it('turns remaining requests into a file count, keeping a reserve', () => {
    expect(deleteAllowance(40)).toBe(3600)
    expect(deleteAllowance(5)).toBe(100)
    expect(deleteAllowance(4)).toBe(0)
    expect(deleteAllowance(0)).toBe(0)
  })
})
