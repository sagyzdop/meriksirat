import { describe, expect, it } from 'vitest'
import {
  MAX_HEAL_DELETES,
  decideAlbumFolder,
  rotateIds,
  tallyHeals,
  planHealDeletes,
  albumBlockedAlertText,
  volumeFolderName,
  isInVolumeFolder,
} from '@/lib/pool/volumes'

describe('volumeFolderName', () => {
  it('is neutral and carries no personal data', () => {
    expect(volumeFolderName('Ab3dE9')).toBe('Volume Ab3dE9')
  })
})

describe('albumBlockedAlertText', () => {
  it('names the album and the count', () => {
    const text = albumBlockedAlertText('a1', 2)
    expect(text).toContain('a1')
    expect(text).toContain('2')
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

describe('tallyHeals', () => {
  it('counts each outcome', () => {
    expect(tallyHeals(['cleared', 'blocked', 'incomplete', 'cleared'])).toEqual(
      { cleared: 2, blocked: 1, incomplete: 1 }
    )
    expect(tallyHeals([])).toEqual({ cleared: 0, blocked: 0, incomplete: 0 })
  })
})

describe('decideAlbumFolder', () => {
  const t = (cleared: number, blocked: number, incomplete: number) => ({
    cleared,
    blocked,
    incomplete,
  })

  it('defers while anything is unfinished, even beside blocked volumes', () => {
    expect(decideAlbumFolder(t(0, 0, 1), false)).toBe('defer')
    expect(decideAlbumFolder(t(2, 1, 1), false)).toBe('defer')
    expect(decideAlbumFolder(t(1, 0, 1), true)).toBe('defer')
  })

  it('retries the delete once when every volume was cleared', () => {
    expect(decideAlbumFolder(t(2, 0, 0), false)).toBe('retry')
    expect(decideAlbumFolder(t(2, 0, 0), true)).toBe('abandon')
  })

  it('abandons only when truly blocked', () => {
    expect(decideAlbumFolder(t(1, 1, 0), false)).toBe('abandon')
    expect(decideAlbumFolder(t(0, 2, 0), false)).toBe('abandon')
    expect(decideAlbumFolder(t(0, 0, 0), false)).toBe('abandon')
  })
})

describe('rotateIds', () => {
  it('starts from a different album each turn', () => {
    expect(rotateIds(['a', 'b', 'c'], 0)).toEqual(['a', 'b', 'c'])
    expect(rotateIds(['a', 'b', 'c'], 1)).toEqual(['b', 'c', 'a'])
    expect(rotateIds(['a', 'b', 'c'], 4)).toEqual(['b', 'c', 'a'])
    expect(rotateIds([], 3)).toEqual([])
  })
})

describe('albumBlockedAlertText with no blocked volumes', () => {
  it('does not claim zero subfolders', () => {
    expect(albumBlockedAlertText('a1', 0)).not.toContain('0 of')
  })
})
