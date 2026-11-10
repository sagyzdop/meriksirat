import { describe, expect, it } from 'vitest'
import { errorMessage } from '@/lib/utils'
import { UserError } from '@/lib/user-error'

describe('errorMessage', () => {
  it('uses the message of a UserError', () => {
    expect(errorMessage(new UserError('Album not found'), 'Failed')).toBe(
      'Album not found'
    )
  })
  it('uses the message of an error that crossed the server boundary', () => {
    const error = new Error('Album not found')
    error.name = 'UserError'
    expect(errorMessage(error, 'Failed')).toBe('Album not found')
  })
  it('falls back for any other error', () => {
    expect(errorMessage(new Error('D1_ERROR: no such column'), 'Failed')).toBe(
      'Failed'
    )
    expect(errorMessage(new TypeError('Failed to fetch'), 'Failed')).toBe(
      'Failed'
    )
    expect(errorMessage(new Error('<!DOCTYPE html>...1102'), 'Failed')).toBe(
      'Failed'
    )
  })
  it('falls back for anything that is not an Error', () => {
    expect(errorMessage('boom', 'Failed')).toBe('Failed')
    expect(errorMessage(undefined, 'Failed')).toBe('Failed')
  })
})
