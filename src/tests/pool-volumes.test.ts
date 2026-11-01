import { describe, expect, it } from 'vitest'
import {
  RELEASE_RETRY_MS,
  planRecoveryShare,
  planVolumeReleases,
  volumeFolderName,
  volumeParents,
  type ReleaseVolume,
} from '@/lib/pool/volumes'

const now = new Date('2026-11-10T12:00:00Z')

const vol = (over: Partial<ReleaseVolume>): ReleaseVolume => ({
  albumId: 'a1',
  driveFolderId: 'sub1',
  permissionId: 'perm1',
  writerRevokedAt: null,
  releaseBlockedAt: null,
  hasPhotos: false,
  ...over,
})

describe('volumeFolderName', () => {
  it('is neutral and carries no personal data', () => {
    expect(volumeFolderName('Ab3dE9')).toBe('Volume Ab3dE9')
  })
})

describe('planVolumeReleases', () => {
  it('keeps volumes that still hold photos', () => {
    const plan = planVolumeReleases([vol({ hasPhotos: true })], now, 10)
    expect(plan.calls).toEqual([])
    expect(plan.drops).toEqual([])
    expect(plan.pending).toHaveLength(1)
  })

  it('deletes the subfolder of an empty volume', () => {
    const plan = planVolumeReleases([vol({})], now, 10)
    expect(plan.calls).toEqual([{ step: 'delete_folder', volume: vol({}) }])
    expect(plan.pending).toEqual([])
  })

  it('revokes the root share of an empty legacy volume', () => {
    const legacy = vol({ driveFolderId: null })
    const plan = planVolumeReleases([legacy], now, 10)
    expect(plan.calls).toEqual([{ step: 'revoke_permission', volume: legacy }])
  })

  it('drops an empty legacy volume whose access is already gone', () => {
    const a = vol({ driveFolderId: null, permissionId: '' })
    const b = vol({
      albumId: 'a2',
      driveFolderId: null,
      writerRevokedAt: now,
    })
    const plan = planVolumeReleases([a, b], now, 10)
    expect(plan.calls).toEqual([])
    expect(plan.drops).toEqual([a, b])
  })

  it('waits out the retry window after a blocked release', () => {
    const recent = vol({
      releaseBlockedAt: new Date(now.getTime() - RELEASE_RETRY_MS + 1000),
    })
    const plan = planVolumeReleases([recent], now, 10)
    expect(plan.calls).toEqual([])
    expect(plan.pending).toEqual([recent])
  })

  it('retries once the window has passed', () => {
    const old = vol({
      releaseBlockedAt: new Date(now.getTime() - RELEASE_RETRY_MS),
    })
    expect(planVolumeReleases([old], now, 10).calls).toHaveLength(1)
  })

  it('limits calls and leaves the rest pending', () => {
    const volumes = ['a', 'b', 'c'].map((albumId) => vol({ albumId }))
    const plan = planVolumeReleases(volumes, now, 2)
    expect(plan.calls).toHaveLength(2)
    expect(plan.pending.map((v) => v.albumId)).toEqual(['c'])
  })
})

describe('planRecoveryShare', () => {
  const base = {
    driveFolderId: 'sub1' as string | null,
    permissionId: '',
    writerRevokedAt: null as Date | null,
    hasPhotoRows: false,
  }

  it('re-shares an empty subfolder whose access is gone', () => {
    expect(planRecoveryShare(base)).toBe(true)
    expect(
      planRecoveryShare({ ...base, permissionId: 'p', writerRevokedAt: now })
    ).toBe(true)
  })

  it('never shares a subfolder that holds photos', () => {
    expect(planRecoveryShare({ ...base, hasPhotoRows: true })).toBe(false)
  })

  it('never shares the root of a legacy volume', () => {
    expect(planRecoveryShare({ ...base, driveFolderId: null })).toBe(false)
  })

  it('does nothing when access was never removed', () => {
    expect(planRecoveryShare({ ...base, permissionId: 'p' })).toBe(false)
  })
})

describe('volumeParents', () => {
  it('lists the subfolder before the root for a volume with a folder', () => {
    expect(volumeParents('root', 'sub1')).toEqual(['sub1', 'root'])
  })

  it('accepts only the root for a legacy volume', () => {
    expect(volumeParents('root', null)).toEqual(['root'])
  })
})
