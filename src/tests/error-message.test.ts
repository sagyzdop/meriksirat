import { describe, expect, it } from 'vitest'
import { errorMessage } from '@/lib/utils'

describe('errorMessage', () => {
  it('uses the message of an Error', () => {
    expect(errorMessage(new Error('Album not found'), 'Failed')).toBe(
      'Album not found'
    )
  })
  it('falls back for anything that is not an Error', () => {
    expect(errorMessage('boom', 'Failed')).toBe('Failed')
    expect(errorMessage(undefined, 'Failed')).toBe('Failed')
  })
})
