import { describe, it, expect } from 'vitest'
import { profileFieldPayload } from '../lib/user/profile-fields'

describe('profileFieldPayload', () => {
  it('saves a trimmed required name', () => {
    expect(profileFieldPayload('firstName', '  Aigerim ')).toEqual({
      ok: true,
      data: { firstName: 'Aigerim' },
    })
  })

  it('rejects an empty required name', () => {
    expect(profileFieldPayload('lastName', '  ')).toEqual({
      ok: false,
      error: 'Last name is required',
    })
  })

  it('lets optional text be cleared and strips a leading @', () => {
    expect(profileFieldPayload('major', '')).toEqual({
      ok: true,
      data: { major: '' },
    })
    expect(profileFieldPayload('instagramUsername', '@aigerim')).toEqual({
      ok: true,
      data: { instagramUsername: 'aigerim' },
    })
  })

  it('turns the NU ID into a number and rejects non-digits', () => {
    expect(profileFieldPayload('nuId', '202012345')).toEqual({
      ok: true,
      data: { nuId: 202012345 },
    })
    expect(profileFieldPayload('nuId', '12ab').ok).toBe(false)
    expect(profileFieldPayload('nuId', '').ok).toBe(false)
  })

  it('passes the graduation date from the month input through', () => {
    expect(profileFieldPayload('graduationDate', '2028-06-01')).toEqual({
      ok: true,
      data: { graduationDate: '2028-06-01' },
    })
    expect(profileFieldPayload('graduationDate', '').ok).toBe(false)
    expect(profileFieldPayload('graduationDate', '2028-06').ok).toBe(false)
  })

  it('passes a birthday through and rejects an empty one', () => {
    expect(profileFieldPayload('birthday', '2003-04-09')).toEqual({
      ok: true,
      data: { birthday: '2003-04-09' },
    })
    expect(profileFieldPayload('birthday', '').ok).toBe(false)
  })
})
