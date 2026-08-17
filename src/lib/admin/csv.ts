import type { AdminUserExport } from './dashboard-types'

// ---------------------------------------------------------------------------
// User export fields
// ---------------------------------------------------------------------------

export type UserExportFieldKey =
  | 'fullName'
  | 'email'
  | 'role'
  | 'status'
  | 'clearanceLevel'
  | 'nuId'
  | 'instagramUsername'
  | 'telegramUsername'
  | 'major'
  | 'graduationYear'
  | 'birthday'
  | 'memberSince'
  | 'autoCancelled'
  | 'overdue'
  | 'albums'

export interface AdminUserExportField {
  key: UserExportFieldKey
  label: string
}

export const USER_EXPORT_FIELDS: AdminUserExportField[] = [
  { key: 'fullName', label: 'Full Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
  { key: 'clearanceLevel', label: 'Clearance Level' },
  { key: 'nuId', label: 'NU ID' },
  { key: 'instagramUsername', label: 'Instagram Username' },
  { key: 'telegramUsername', label: 'Telegram Username' },
  { key: 'major', label: 'Major' },
  { key: 'graduationYear', label: 'Graduation Year' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'memberSince', label: 'Member Since' },
  { key: 'autoCancelled', label: 'Auto-Cancelled' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'albums', label: 'Albums' },
]

/** Every exportable column, in display order. Used as the default selection. */
export const DEFAULT_USER_EXPORT_KEYS: readonly UserExportFieldKey[] =
  USER_EXPORT_FIELDS.map((field) => field.key)

function formatMemberSince(createdAt: Date | string): string {
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function formatBirthday(birthday: string | null): string {
  if (!birthday) return ''
  const date = new Date(birthday)
  if (Number.isNaN(date.getTime())) return birthday
  return date.toISOString().slice(0, 10)
}

export function getUserExportFieldValue(
  user: AdminUserExport,
  key: UserExportFieldKey
): string {
  switch (key) {
    case 'fullName': {
      const fullName = [user.firstName, user.lastName]
        .filter(Boolean)
        .join(' ')
        .trim()
      return fullName || user.name || ''
    }
    case 'memberSince':
      return formatMemberSince(user.createdAt)
    case 'birthday':
      return formatBirthday(user.birthday)
    case 'autoCancelled':
      return String(user.cancelledInStartWindowCount)
    case 'overdue':
      return String(user.overdueCount)
    case 'albums':
      return String(user.albumCount)
    case 'email':
    case 'role':
    case 'status':
    case 'clearanceLevel':
    case 'nuId':
    case 'instagramUsername':
    case 'telegramUsername':
    case 'major':
    case 'graduationYear':
      return stringifyCsvValue(user[key])
    default:
      return ''
  }
}

// ---------------------------------------------------------------------------
// CSV building
// ---------------------------------------------------------------------------

export function escapeCsvValue(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function stringifyCsvValue(
  value: string | number | boolean | null | undefined
): string {
  if (value == null) return ''
  const str =
    typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
  return escapeCsvValue(str)
}

/**
 * Renders rows to a CSV string. A UTF-8 BOM is prepended so Excel opens the
 * file with correct encoding.
 */
export function buildCsv(lines: string[][]): string {
  const body = lines
    .map((row) => row.map(stringifyCsvValue).join(','))
    .join('\n')
  return `\uFEFF${body}\n`
}

export function usersToCsv(
  users: AdminUserExport[],
  keys: readonly UserExportFieldKey[] = DEFAULT_USER_EXPORT_KEYS
): string {
  const header = keys.map(
    (key) => USER_EXPORT_FIELDS.find((field) => field.key === key)?.label ?? key
  )
  const rows = users.map((user) =>
    keys.map((key) => getUserExportFieldValue(user, key))
  )
  return buildCsv([header, ...rows])
}
