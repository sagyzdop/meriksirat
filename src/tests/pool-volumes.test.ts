import { describe, expect, it } from 'vitest'
import {
  rotateIds,
  albumBlockedAlertText,
  volumeFolderName,
  isInVolumeFolder,
} from '@/lib/pool/volumes'

describe('volumeFolderName', () => {
  it('pads the number to two digits so folders sort in order', () => {
    expect(volumeFolderName(1, 'Ab3dE9')).toBe('V01Ab3dE9')
    expect(volumeFolderName(12, 'Ab3dE9')).toBe('V12Ab3dE9')
  })
})

describe('albumBlockedAlertText', () => {
  it('names the album and the count', () => {
    const text = albumBlockedAlertText('a1', 2)
    expect(text).toContain('a1')
    expect(text).toContain('2')
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
