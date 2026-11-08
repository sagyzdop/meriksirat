import { describe, expect, it } from 'vitest'
import { VOLUME_MAX_BYTES, pickVolumeWithRoom } from '@/lib/albums/volume-limit'

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
