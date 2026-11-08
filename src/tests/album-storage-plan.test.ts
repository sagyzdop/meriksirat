import { describe, expect, it } from 'vitest'
import {
  assignVolumes,
  bufferHasRoom,
  canReusePending,
  deletionDate,
  deletionNoticeText,
  deletionRecipients,
  goneFromSource,
  matchFiles,
  matchVolumeCopies,
  nextOffloadStep,
  offloadCopiesToKeep,
  pickFlamekeeper,
  planDrainStep,
  planMoves,
  planOffloadVolumes,
  trimPending,
  unknownSourceFiles,
  verifyCopy,
  type OffloadPending,
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

describe('assignVolumes', () => {
  it('spends each flamekeeper’s room across volumes', () => {
    const picks = assignVolumes([6, 6], [c('a', 10), c('b', 8)])
    expect(picks?.map((p) => p.userId)).toEqual(['a', 'b'])
  })
  it('fails when any volume has nowhere to go', () => {
    expect(assignVolumes([6, 6], [c('a', 10)])).toBeNull()
  })
})

describe('multi-volume offload pending', () => {
  const file = (id: string, size = 1, folder = 'b1') => ({
    id,
    name: id,
    size,
    md5: id,
    mimeType: 'image/jpeg',
    sourceFolderId: folder,
  })
  const pending = (): OffloadPending => ({
    startedAt: 0,
    sourceFolders: ['b1', 'b2'],
    checkedFolders: [],
    volumes: [
      {
        volumeId: 'v1',
        destUserId: 'a',
        volumeFolderId: 'f1',
        permissionId: 'p',
        bytes: 1,
        files: [file('x')],
      },
      {
        volumeId: 'v2',
        destUserId: 'a',
        volumeFolderId: null,
        permissionId: null,
        bytes: 1,
        files: [file('y', 1, 'b2')],
      },
    ],
  })

  it('reuses with the same or fewer files and enough room', () => {
    expect(canReusePending(pending(), ['x', 'y'], new Map([['a', 2]]))).toBe(
      true
    )
    expect(canReusePending(pending(), ['x'], new Map([['a', 9]]))).toBe(true)
    expect(canReusePending(pending(), ['x', 'y'], new Map([['a', 1]]))).toBe(
      false
    )
    expect(canReusePending(pending(), ['x', 'z'], new Map([['a', 9]]))).toBe(
      false
    )
    expect(canReusePending(pending(), [], new Map([['a', 9]]))).toBe(false)
  })

  it('trims photos deleted since the start and forgets verification', () => {
    const p = pending()
    p.volumes[0].copies = [{ sourceId: 'x', copyId: 'c', size: 1 }]
    const trimmed = trimPending(p, ['x'])
    expect(trimmed.volumes[0].files.map((f) => f.id)).toEqual(['x'])
    expect(trimmed.volumes[0].copies).toBeUndefined()
    expect(trimmed.volumes[1].files).toEqual([])
    expect(trimmed.volumes[1].bytes).toBe(0)
  })

  it('flags buffer files the plan does not know', () => {
    expect(unknownSourceFiles(pending(), ['x', 'y'])).toEqual([])
    expect(unknownSourceFiles(pending(), ['x', 'new'])).toEqual(['new'])
  })

  it('finds planned photos missing from a source folder', () => {
    expect(goneFromSource(pending(), 'b1', [])).toEqual(['x'])
    expect(goneFromSource(pending(), 'b1', ['x'])).toEqual([])
    expect(goneFromSource(pending(), 'b2', [])).toEqual(['y'])
  })

  it('verifies every volume before checking the buffer, then commits', () => {
    const p = pending()
    expect(nextOffloadStep(p)).toEqual({ kind: 'verify', volumeId: 'v1' })
    p.volumes[0].copies = []
    p.volumes[1].copies = []
    expect(nextOffloadStep(p)).toEqual({
      kind: 'check-source',
      folderId: 'b1',
    })
    p.checkedFolders = ['b1', 'b2']
    expect(nextOffloadStep(p)).toEqual({ kind: 'commit' })
  })
})

describe('matchVolumeCopies', () => {
  it('pairs copies, lists duplicates as extras and reports missing', () => {
    const result = matchVolumeCopies(
      [f('a', 'm1'), f('b', 'm2')],
      [f('c1', 'm1', 10, 'a'), f('c2', 'm1', 10, 'a')]
    )
    expect(result.copies).toEqual([{ sourceId: 'a', copyId: 'c1', size: 10 }])
    expect(result.extras).toEqual(['c2'])
    expect(result.missing.map((m) => m.id)).toEqual(['b'])
  })
})

describe('offloadCopiesToKeep', () => {
  it('drops extras and copies of photos deleted during the move', () => {
    const result = offloadCopiesToKeep(
      {
        volumeId: 'v',
        destUserId: 'a',
        volumeFolderId: 'f',
        permissionId: 'p',
        bytes: 2,
        files: [],
        copies: [
          { sourceId: 'x', copyId: 'cx', size: 1 },
          { sourceId: 'y', copyId: 'cy', size: 1 },
        ],
        extras: ['dup'],
      },
      new Set(['y'])
    )
    expect(result.keep.map((c) => c.copyId)).toEqual(['cx'])
    expect(result.drop).toEqual(['dup', 'cy'])
  })
})

describe('planOffloadVolumes', () => {
  it('packs files into capped volumes and spreads them over room', () => {
    const files = [
      { id: '1', size: 6 },
      { id: '2', size: 6 },
      { id: '3', size: 3 },
    ]
    const planned = planOffloadVolumes(files, [c('a', 10), c('b', 8)], 10)
    expect(planned?.map((p) => [p.userId, p.bytes])).toEqual([
      ['a', 9],
      ['b', 6],
    ])
  })
  it('fails when a volume has nowhere to go', () => {
    expect(
      planOffloadVolumes([{ size: 6 }, { size: 6 }], [c('a', 7)], 10)
    ).toBe(null)
  })
})
