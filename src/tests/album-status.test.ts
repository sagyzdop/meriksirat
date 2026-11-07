import { describe, expect, it } from 'vitest'
import { albumStatus, albumStorageHolder } from '@/lib/albums/status'

const now = new Date()

describe('albumStatus', () => {
  it('has no status by default', () => {
    expect(
      albumStatus({ rescuedAt: null, scheduledDeletionAt: null })
    ).toBeNull()
  })
  it('is rescued when only rescued', () => {
    expect(albumStatus({ rescuedAt: now, scheduledDeletionAt: null })).toBe(
      'rescued'
    )
  })
  it('lets scheduled deletion win', () => {
    expect(albumStatus({ rescuedAt: now, scheduledDeletionAt: now })).toBe(
      'scheduled_deletion'
    )
  })
})

describe('albumStorageHolder', () => {
  it('is none without volumes', () => {
    expect(albumStorageHolder([])).toBe('none')
  })
  it('is buffer for a buffer volume', () => {
    expect(albumStorageHolder([{ flamekeeperUserId: null }])).toBe('buffer')
  })
  it('is flamekeeper for a flamekeeper volume', () => {
    expect(albumStorageHolder([{ flamekeeperUserId: 'u1' }])).toBe(
      'flamekeeper'
    )
  })
  it('ignores dropped volumes', () => {
    expect(
      albumStorageHolder([{ flamekeeperUserId: 'u1', droppedAt: now }])
    ).toBe('none')
  })
})
