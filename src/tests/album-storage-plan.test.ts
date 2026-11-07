import { describe, expect, it } from 'vitest'
import {
  bufferHasRoom,
  deletionDate,
  deletionNoticeText,
  deletionRecipients,
  matchFiles,
  pickFlamekeeper,
  planDrainStep,
  planMoves,
  verifyCopy,
  type FileIdentity,
  type PlacementCandidate,
} from '@/lib/albums/storage-plan'
import { planEnd } from '@/lib/pool/stop'

const GB = 1024 * 1024 * 1024
const c = (userId: string, freeBytes: number): PlacementCandidate => ({
  userId,
  name: userId,
  freeBytes,
})
const album = (
  albumId: string,
  bytes: number,
  holder: 'buffer' | 'flamekeeper' | 'none'
) => ({ albumId, title: albumId, bytes, holder })
const f = (id: string, md5: string, size = 10, name = id): FileIdentity => ({
  id,
  name,
  size,
  md5,
})

describe('pickFlamekeeper', () => {
  it('accepts an album that fits exactly', () => {
    expect(pickFlamekeeper(5 * GB, [c('a', 5 * GB)])?.userId).toBe('a')
  })

  it('refuses an album one byte too big', () => {
    expect(pickFlamekeeper(5 * GB + 1, [c('a', 5 * GB)])).toBeNull()
  })

  it('returns null with no eligible account', () => {
    expect(pickFlamekeeper(1, [])).toBeNull()
  })

  it('picks the least loaded account, ties by id', () => {
    expect(pickFlamekeeper(1, [c('b', 9), c('a', 9), c('c', 5)])?.userId).toBe(
      'a'
    )
  })

  it('does not split an album across accounts', () => {
    expect(pickFlamekeeper(8, [c('a', 5), c('b', 5)])).toBeNull()
  })
})

describe('planMoves', () => {
  const mixed = [
    album('b1', 4, 'buffer'),
    album('b2', 4, 'buffer'),
    album('f1', 4, 'flamekeeper'),
    album('n1', 4, 'none'),
  ]

  it('counts a mixed selection for the flamekeeper target', () => {
    const plan = planMoves({
      albums: mixed,
      target: 'flamekeeper',
      candidates: [c('a', 100)],
    })
    expect(plan.counts).toEqual({
      selected: 4,
      onBuffer: 2,
      onFlamekeeper: 1,
      unknown: 1,
      movable: 2,
      skipped: 2,
    })
    expect(plan.items[3].skipReason).toBe('No storage record')
    expect(plan.items[0].flamekeeperUserId).toBe('a')
  })

  it('skips albums already on the buffer for the buffer target', () => {
    const plan = planMoves({
      albums: mixed,
      target: 'buffer',
      candidates: [],
    })
    expect(plan.items[0].skipReason).toBe('Already on the buffer')
    expect(plan.items[2].skipReason).toBeUndefined()
    expect(plan.counts.movable).toBe(1)
    expect(plan.counts.skipped).toBe(3)
  })

  it('spends capacity across the batch and skips what no longer fits', () => {
    const plan = planMoves({
      albums: [album('x', 6, 'buffer'), album('y', 6, 'buffer')],
      target: 'flamekeeper',
      candidates: [c('a', 10)],
    })
    expect(plan.items[0].flamekeeperUserId).toBe('a')
    expect(plan.items[1].skipReason).toBe('No flamekeeper has room')
  })

  it('is deterministic', () => {
    const input = {
      albums: mixed,
      target: 'flamekeeper' as const,
      candidates: [c('b', 50), c('a', 50)],
    }
    expect(planMoves(input)).toEqual(planMoves(input))
  })
})

describe('verifyCopy', () => {
  it('accepts a full match regardless of ids and order', () => {
    const src = [f('1', 'a'), f('2', 'b')]
    expect(
      verifyCopy(src, [f('y', 'b', 10, '2'), f('x', 'a', 10, '1')]).ok
    ).toBe(true)
  })

  it('rejects a missing file', () => {
    expect(verifyCopy([f('1', 'a'), f('2', 'b')], [f('x', 'a')]).ok).toBe(false)
  })

  it('rejects a wrong checksum', () => {
    expect(verifyCopy([f('1', 'a')], [f('x', 'z')]).ok).toBe(false)
  })

  it('pairs duplicate files one to one', () => {
    const match = matchFiles(
      [f('1', 'a', 1, 'n'), f('2', 'a', 1, 'n')],
      [f('x', 'a', 1, 'n')]
    )
    expect(match.pairs).toHaveLength(1)
    expect(match.missing).toHaveLength(1)
  })
})

describe('drain ordering', () => {
  it('stays draining while volumes remain', () => {
    expect(planEnd(2)).toBe('draining')
    expect(planDrainStep({ heldVolumes: 2, bufferFull: false })).toEqual({
      kind: 'rescue',
    })
  })

  it('finalizes at zero volumes', () => {
    expect(planEnd(0)).toBe('drained')
    expect(planDrainStep({ heldVolumes: 0, bufferFull: true })).toEqual({
      kind: 'finalize',
    })
  })

  it('pauses with an alert when the buffer is full', () => {
    expect(planDrainStep({ heldVolumes: 1, bufferFull: true })).toEqual({
      kind: 'pause',
      alert: 'buffer_full',
    })
  })
})

describe('bufferHasRoom', () => {
  it('fits up to the limit and not past it', () => {
    expect(bufferHasRoom(90, 100, 10)).toBe(true)
    expect(bufferHasRoom(90, 100, 11)).toBe(false)
    expect(bufferHasRoom(90, null, 1000)).toBe(true)
  })
})

describe('scheduled deletion', () => {
  it('adds the notice days', () => {
    const now = new Date('2026-11-07T10:00:00Z')
    expect(deletionDate(now, 14).toISOString()).toBe('2026-11-21T10:00:00.000Z')
  })

  it('notifies the owner and each favoriter once', () => {
    expect(deletionRecipients('o', ['u1', 'o', 'u1', 'u2'])).toEqual([
      'o',
      'u1',
      'u2',
    ])
  })

  it('names the date and the link', () => {
    const text = deletionNoticeText(
      'Hike',
      'Nov 21, 2026',
      'https://x/albums/1'
    )
    expect(text).toContain('Hike')
    expect(text).toContain('Nov 21, 2026')
    expect(text).toContain('https://x/albums/1')
  })
})
