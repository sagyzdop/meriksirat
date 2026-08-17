import { describe, it, expect } from 'vitest'
import {
  DEFAULT_USER_EXPORT_KEYS,
  USER_EXPORT_FIELDS,
  buildCsv,
  escapeCsvValue,
  getUserExportFieldValue,
  stringifyCsvValue,
  usersToCsv,
} from '../lib/admin/csv'
import type { AdminUserExport } from '../lib/admin/dashboard-types'

const sampleUser: AdminUserExport = {
  id: 'u1',
  name: '',
  email: 'jane@example.com',
  role: 'user',
  status: 'Active',
  clearanceLevel: 3,
  firstName: 'Jane',
  lastName: 'Doe',
  instagramUsername: 'janedoe',
  nuId: 12345,
  telegramUsername: null,
  telegramChatId: null,
  major: 'Computer Science',
  graduationYear: 2027,
  birthday: '2003-07-14',
  onboardingComplete: true,
  cancelledInStartWindowCount: 2,
  overdueCount: 1,
  albumCount: 5,
  createdAt: new Date('2025-03-15T10:00:00Z'),
  updatedAt: new Date('2025-03-16T10:00:00Z'),
}

describe('escapeCsvValue', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCsvValue('hello')).toBe('hello')
    expect(escapeCsvValue('with spaces')).toBe('with spaces')
  })

  it('wraps values containing commas, quotes, or newlines', () => {
    expect(escapeCsvValue('a,b')).toBe('"a,b"')
    expect(escapeCsvValue('multi\nline')).toBe('"multi\nline"')
  })

  it('doubles embedded double quotes', () => {
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""')
  })
})

describe('stringifyCsvValue', () => {
  it('returns empty string for nullish values', () => {
    expect(stringifyCsvValue(null)).toBe('')
    expect(stringifyCsvValue(undefined)).toBe('')
  })

  it('stringifies numbers and booleans', () => {
    expect(stringifyCsvValue(42)).toBe('42')
    expect(stringifyCsvValue(true)).toBe('true')
    expect(stringifyCsvValue(false)).toBe('false')
  })

  it('escapes strings', () => {
    expect(stringifyCsvValue('a,b')).toBe('"a,b"')
  })
})

describe('buildCsv', () => {
  it('prepends a UTF-8 BOM', () => {
    expect(buildCsv([['a']])).toMatch(/^\uFEFF/)
  })

  it('joins rows with newlines and columns with commas', () => {
    expect(
      buildCsv([
        ['a', 'b'],
        ['c', 'd'],
      ])
    ).toBe('\uFEFFa,b\nc,d\n')
  })

  it('escapes cell values', () => {
    expect(buildCsv([['a,b']])).toBe('\uFEFF"a,b"\n')
  })
})

describe('getUserExportFieldValue', () => {
  it('derives fullName from first and last name', () => {
    expect(getUserExportFieldValue(sampleUser, 'fullName')).toBe('Jane Doe')
  })

  it('formats memberSince as date-only', () => {
    expect(getUserExportFieldValue(sampleUser, 'memberSince')).toBe(
      '2025-03-15'
    )
  })

  it('formats birthday as date-only', () => {
    expect(getUserExportFieldValue(sampleUser, 'birthday')).toBe('2003-07-14')
  })

  it('returns empty string for a missing birthday', () => {
    expect(
      getUserExportFieldValue({ ...sampleUser, birthday: null }, 'birthday')
    ).toBe('')
  })

  it('renders violation counters as strings', () => {
    expect(getUserExportFieldValue(sampleUser, 'autoCancelled')).toBe('2')
    expect(getUserExportFieldValue(sampleUser, 'overdue')).toBe('1')
  })

  it('returns empty string for nullish direct fields', () => {
    expect(getUserExportFieldValue(sampleUser, 'telegramUsername')).toBe('')
  })
})

describe('usersToCsv', () => {
  it('writes a header row plus one row per user', () => {
    const csv = usersToCsv([sampleUser], ['fullName', 'email'])
    const lines = csv
      .replace(/^\uFEFF/, '')
      .trimEnd()
      .split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('Full Name,Email')
    expect(lines[1]).toBe('Jane Doe,jane@example.com')
  })

  it('uses default keys when none are provided', () => {
    const csv = usersToCsv([sampleUser])
    const lines = csv
      .replace(/^\uFEFF/, '')
      .trimEnd()
      .split('\n')
    const expectedHeader = DEFAULT_USER_EXPORT_KEYS.map(
      (key) => USER_EXPORT_FIELDS.find((field) => field.key === key)?.label
    ).join(',')
    expect(lines[0]).toBe(expectedHeader)
    expect(lines[1]).toContain('jane@example.com')
    expect(lines[1]).toContain('2025-03-15')
    expect(lines[1]).toContain(',2,1')
  })

  it('escapes special characters in derived values', () => {
    const userWithComma: AdminUserExport = {
      ...sampleUser,
      lastName: 'Doe, Jr.',
    }
    const csv = usersToCsv([userWithComma], ['fullName'])
    expect(csv).toContain('"Jane Doe, Jr."')
  })

  it('returns only the header for an empty list', () => {
    const csv = usersToCsv([], ['email'])
    const lines = csv
      .replace(/^\uFEFF/, '')
      .trimEnd()
      .split('\n')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toBe('Email')
  })
})
