import { describe, expect, it } from 'vitest'
import {
  graduationConfirmDue,
  graduationPromptEmailDue,
  type GraduationConfirmState,
} from '@/lib/pool/graduation'

const NOW = new Date('2026-11-01T10:00:00Z')

describe('yearly confirmation', () => {
  const base: GraduationConfirmState = {
    state: 'active',
    createdAt: new Date('2025-10-01T00:00:00Z'),
    graduationConfirmedAt: null,
    graduationPromptSentAt: null,
  }

  it('is not due within a year of signup or confirmation', () => {
    expect(
      graduationConfirmDue({ ...base, createdAt: new Date('2026-03-01') }, NOW)
    ).toBe(false)
    expect(
      graduationConfirmDue(
        { ...base, graduationConfirmedAt: new Date('2026-06-01') },
        NOW
      )
    ).toBe(false)
  })

  it('is due a year after the last confirmation', () => {
    expect(graduationConfirmDue(base, NOW)).toBe(true)
  })

  it('is never due for drained or lost flamekeepers', () => {
    expect(graduationConfirmDue({ ...base, state: 'drained' }, NOW)).toBe(false)
    expect(graduationConfirmDue({ ...base, state: 'lost' }, NOW)).toBe(false)
  })

  it('emails once per cycle', () => {
    expect(graduationPromptEmailDue(base, NOW)).toBe(true)
    expect(
      graduationPromptEmailDue(
        { ...base, graduationPromptSentAt: new Date('2026-10-05') },
        NOW
      )
    ).toBe(false)
    expect(
      graduationPromptEmailDue(
        { ...base, graduationPromptSentAt: new Date('2025-10-05') },
        NOW
      )
    ).toBe(true)
  })
})
