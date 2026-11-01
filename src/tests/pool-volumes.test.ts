import { describe, expect, it } from 'vitest'
import {
  MAX_HEAL_DELETES,
  RELEASE_FALLBACK_MS,
  RELEASE_RETRY_MS,
  isReleaseAbandoned,
  planHealDeletes,
  releaseAbandonedCutoff,
  planRecoveryShare,
  albumBlockedAlertText,
  planVolumeReleases,
  volumeFolderName,
  isInVolumeFolder,
  type ReleaseVolume,
} from '@/lib/pool/volumes'

const now = new Date('2026-11-10T12:00:00Z')

const vol = (over: Partial<ReleaseVolume>): ReleaseVolume => ({
  albumId: 'a1',
  driveFolderId: 'sub1',
  releaseLastBlockedAt: null,
  releaseFirstBlockedAt: null,
  ...over,
})

describe('volumeFolderName', () => {
  it('is neutral and carries no personal data', () => {
    expect(volumeFolderName('Ab3dE9')).toBe('Volume Ab3dE9')
  })
})

describe('planVolumeReleases abandoned and alerted', () => {
  const stuck = {
    releaseLastBlockedAt: new Date(now.getTime() - RELEASE_RETRY_MS),
    releaseFirstBlockedAt: new Date(now.getTime() - RELEASE_FALLBACK_MS),
  }

  it('stops retrying an abandoned volume once its alert was sent', () => {
    const done = vol({ ...stuck, releaseAlertedAt: new Date(now.getTime()) })
    const plan = planVolumeReleases([done], now, 10)
    expect(plan.calls).toEqual([])
    expect(plan.pending).toEqual([])
  })

  it('keeps retrying an abandoned volume whose alert is not sent', () => {
    const plan = planVolumeReleases([vol(stuck)], now, 10)
    expect(plan.calls).toHaveLength(1)
  })

  it('keeps retrying an alerted volume that is not yet abandoned', () => {
    const young = vol({
      releaseLastBlockedAt: new Date(now.getTime() - RELEASE_RETRY_MS),
      releaseFirstBlockedAt: new Date(now.getTime() - RELEASE_FALLBACK_MS + 1),
      releaseAlertedAt: now,
    })
    expect(planVolumeReleases([young], now, 10).calls).toHaveLength(1)
  })
})

describe('albumBlockedAlertText', () => {
  it('names the album and the count', () => {
    const text = albumBlockedAlertText('a1', 2)
    expect(text).toContain('a1')
    expect(text).toContain('2')
  })
})

describe('planVolumeReleases', () => {
  it('deletes the subfolder of an empty volume', () => {
    const plan = planVolumeReleases([vol({})], now, 10)
    expect(plan.calls).toEqual([vol({})])
    expect(plan.pending).toEqual([])
  })

  it('drops an empty volume that has no subfolder', () => {
    const a = vol({ driveFolderId: null })
    const plan = planVolumeReleases([a], now, 10)
    expect(plan.calls).toEqual([])
    expect(plan.drops).toEqual([a])
  })

  it('waits out the retry window after a blocked release', () => {
    const recent = vol({
      releaseLastBlockedAt: new Date(now.getTime() - RELEASE_RETRY_MS + 1000),
    })
    const plan = planVolumeReleases([recent], now, 10)
    expect(plan.calls).toEqual([])
    expect(plan.pending).toEqual([recent])
  })

  it('retries once the window has passed', () => {
    const old = vol({
      releaseLastBlockedAt: new Date(now.getTime() - RELEASE_RETRY_MS),
    })
    expect(planVolumeReleases([old], now, 10).calls).toHaveLength(1)
  })

  it('stops counting a volume blocked for 7 days as pending', () => {
    const stuck = vol({
      releaseLastBlockedAt: new Date(now.getTime() - 1000),
      releaseFirstBlockedAt: new Date(now.getTime() - RELEASE_FALLBACK_MS),
    })
    const young = vol({
      albumId: 'a2',
      releaseLastBlockedAt: new Date(now.getTime() - 1000),
      releaseFirstBlockedAt: new Date(now.getTime() - RELEASE_FALLBACK_MS + 1),
    })
    const plan = planVolumeReleases([stuck, young], now, 10)
    expect(plan.pending).toEqual([young])
  })

  it('still retries an abandoned volume once its window has passed', () => {
    const stuck = vol({
      releaseLastBlockedAt: new Date(now.getTime() - RELEASE_RETRY_MS),
      releaseFirstBlockedAt: new Date(now.getTime() - 8 * 24 * 3600 * 1000),
    })
    expect(planVolumeReleases([stuck], now, 10).calls).toEqual([stuck])
  })

  it('limits calls and leaves the rest pending', () => {
    const volumes = ['a', 'b', 'c'].map((albumId) => vol({ albumId }))
    const plan = planVolumeReleases(volumes, now, 2)
    expect(plan.calls).toHaveLength(2)
    expect(plan.pending.map((v) => v.albumId)).toEqual(['c'])
  })
})

describe('isReleaseAbandoned', () => {
  it('is true from exactly 7 days after blocking started', () => {
    const since = (ms: number) => ({
      releaseFirstBlockedAt: new Date(now.getTime() - ms),
    })
    expect(isReleaseAbandoned(since(RELEASE_FALLBACK_MS - 1), now)).toBe(false)
    expect(isReleaseAbandoned(since(RELEASE_FALLBACK_MS), now)).toBe(true)
    expect(isReleaseAbandoned({ releaseFirstBlockedAt: null }, now)).toBe(false)
  })

  it('matches the cutoff used for queries', () => {
    expect(releaseAbandonedCutoff(now).toISOString()).toBe(
      '2026-11-03T12:00:00.000Z'
    )
  })
})

describe('planHealDeletes', () => {
  it('skips files a photo row still needs', () => {
    expect(planHealDeletes(['f1', 'f2', 'f3'], ['f2'])).toEqual(['f1', 'f3'])
  })

  it('caps the number of deletes per attempt', () => {
    const ids = Array.from({ length: 80 }, (_, i) => `f${i}`)
    expect(planHealDeletes(ids, [])).toHaveLength(MAX_HEAL_DELETES)
    expect(planHealDeletes(ids, [], 3)).toEqual(['f0', 'f1', 'f2'])
  })

  it('ignores duplicates and empty listings', () => {
    expect(planHealDeletes(['f1', 'f1'], [])).toEqual(['f1'])
    expect(planHealDeletes([], ['f1'])).toEqual([])
  })
})

describe('planRecoveryShare', () => {
  const base = {
    driveFolderId: 'sub1' as string | null,
    permissionId: '',
    hasPhotoRows: false,
  }

  it('re-shares an empty subfolder whose access is gone', () => {
    expect(planRecoveryShare(base)).toBe(true)
  })

  it('never shares a subfolder that holds photos', () => {
    expect(planRecoveryShare({ ...base, hasPhotoRows: true })).toBe(false)
  })

  it('never shares a volume that has no subfolder', () => {
    expect(planRecoveryShare({ ...base, driveFolderId: null })).toBe(false)
  })

  it('does nothing when access was never removed', () => {
    expect(planRecoveryShare({ ...base, permissionId: 'p' })).toBe(false)
  })
})

describe('isInVolumeFolder', () => {
  it('accepts a file in the volume subfolder', () => {
    expect(isInVolumeFolder({ parents: ['x', 'sub1'] }, 'sub1')).toBe(true)
  })

  it('rejects a trashed file or one elsewhere', () => {
    expect(isInVolumeFolder({ parents: ['sub1'], trashed: true }, 'sub1')).toBe(
      false
    )
    expect(isInVolumeFolder({ parents: ['other'] }, 'sub1')).toBe(false)
    expect(isInVolumeFolder({}, 'sub1')).toBe(false)
  })

  it('accepts nothing while a volume has no subfolder', () => {
    expect(isInVolumeFolder({ parents: ['sub1'] }, null)).toBe(false)
  })
})
