import { describe, expect, it } from 'vitest'
import {
  VOLUME_MAX_BYTES,
  packFiles,
  pickVolumeWithRoom,
  splitBytes,
} from '@/lib/albums/volume-limit'

describe('pickVolumeWithRoom', () => {
  it('uses a volume that stays under the cap', () => {
    const v = { id: 'a', expectedBytes: 100 }
    expect(pickVolumeWithRoom([v], 1000)).toBe(v)
  })
  it('skips a volume the file would overflow', () => {
    const full = { id: 'a', expectedBytes: VOLUME_MAX_BYTES - 10 }
    const roomy = { id: 'b', expectedBytes: 0 }
    expect(pickVolumeWithRoom([full, roomy], 100)).toBe(roomy)
  })
  it('opens a new volume when none has room', () => {
    expect(
      pickVolumeWithRoom([{ id: 'a', expectedBytes: VOLUME_MAX_BYTES }], 1)
    ).toBeNull()
  })
  it('puts an oversized file in an empty volume', () => {
    const empty = { id: 'a', expectedBytes: null }
    expect(pickVolumeWithRoom([empty], VOLUME_MAX_BYTES * 2)).toBe(empty)
  })
})

describe('packFiles', () => {
  const f = (size: number) => ({ size })
  const MB = 1024 * 1024
  it('keeps every volume within the cap', () => {
    const groups = packFiles([
      f(200 * MB),
      f(100 * MB),
      f(50 * MB),
      f(150 * MB),
    ])
    expect(groups.map((g) => g.reduce((n, x) => n + x.size, 0))).toEqual([
      250 * MB,
      250 * MB,
    ])
  })
  it('puts a file over the cap alone', () => {
    const groups = packFiles([f(10), f(VOLUME_MAX_BYTES + 5), f(10)])
    expect(groups).toHaveLength(2)
    expect(groups[1]).toEqual([f(VOLUME_MAX_BYTES + 5)])
  })
  it('returns no groups for no files', () => {
    expect(packFiles([])).toEqual([])
  })
})

describe('splitBytes', () => {
  it('splits a total into capped volumes', () => {
    expect(splitBytes(VOLUME_MAX_BYTES * 2 + 7)).toEqual([
      VOLUME_MAX_BYTES,
      VOLUME_MAX_BYTES,
      7,
    ])
    expect(splitBytes(0)).toEqual([0])
  })
})
