import { describe, expect, it } from 'vitest'
import { albumStatus, albumStorageHolder } from '@/lib/albums/status'

const now = new Date()

const base = { rescuedAt: null, scheduledDeletionAt: null }

describe('albumStatus', () => {
  it('is healthy by default', () => {
    expect(albumStatus(base)).toBe('healthy')
  })
  it('is healthy with sound flamekeepers', () => {
    expect(
      albumStatus({ ...base, volumes: [{ flamekeeperState: 'active' }] })
    ).toBe('healthy')
  })
  it('is unhealthy when a live volume sits on a lost flamekeeper', () => {
    expect(
      albumStatus({ ...base, volumes: [{ flamekeeperState: 'lost' }] })
    ).toBe('unhealthy')
  })
  it('is unhealthy when a flamekeeper is partially lost', () => {
    expect(
      albumStatus({
        ...base,
        volumes: [{ flamekeeperState: 'active', flamekeeperLostSince: now }],
      })
    ).toBe('unhealthy')
  })
  it('ignores dropped volumes', () => {
    expect(
      albumStatus({
        ...base,
        volumes: [{ flamekeeperState: 'lost', droppedAt: now }],
      })
    ).toBe('healthy')
  })
  it('is rescued over unhealthy', () => {
    expect(
      albumStatus({
        rescuedAt: now,
        scheduledDeletionAt: null,
        volumes: [{ flamekeeperState: 'lost' }],
      })
    ).toBe('rescued')
  })
  it('lets scheduled deletion win over rescued', () => {
    expect(albumStatus({ rescuedAt: now, scheduledDeletionAt: now })).toBe(
      'scheduled_deletion'
    )
  })
  it('is deleted when deleted without a loss reason', () => {
    expect(albumStatus({ ...base, deletedAt: now })).toBe('deleted')
  })
  it.each(['flamekeeper_lost', 'flamekeeper_left', 'folder_deleted'])(
    'is lost for tombstone %s',
    (tombstoneReason) => {
      expect(
        albumStatus({
          rescuedAt: now,
          scheduledDeletionAt: now,
          deletedAt: now,
          tombstoneReason,
        })
      ).toBe('lost')
    }
  )
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
