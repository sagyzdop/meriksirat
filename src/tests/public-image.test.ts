import { describe, expect, it } from 'vitest'
import { publicImageKey } from '@/lib/cache/public-image'
import { fitWithin } from '@/lib/equipment/shrink-image'

describe('publicImageKey', () => {
  it('serves equipment photos publicly', () => {
    expect(
      publicImageKey('/api/images/equipment-images/5-1773319336878.jpeg')
    ).toBe('equipment-images/5-1773319336878.jpeg')
  })

  it('leaves every other image to the app', () => {
    expect(publicImageKey('/api/images/avatars/u1.jpg')).toBeNull()
    expect(publicImageKey('/api/images/equipment-images/a/b.jpg')).toBeNull()
    expect(publicImageKey('/api/images/equipment-images/..')).toBeNull()
    expect(publicImageKey('/equipment')).toBeNull()
  })
})

describe('fitWithin', () => {
  it('scales the longer side down to the limit', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1280, height: 960 })
    expect(fitWithin(3000, 4000)).toEqual({ width: 960, height: 1280 })
  })

  it('never scales up', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
})
