import { CLUB_TIMEZONE } from '@/lib/club-time'

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / 1024 ** exponent
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}

function toValidDate(value: string | number | Date | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatUtcDate(
  value: string | number | Date | null | undefined
): string {
  const date = toValidDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat('en-GB', {
    ...DATE_OPTIONS,
    timeZone: 'UTC',
  }).format(date)
}

export function formatDate(
  value: string | number | Date | null | undefined
): string {
  const date = toValidDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat('en-GB', {
    ...DATE_OPTIONS,
    timeZone: CLUB_TIMEZONE,
  }).format(date)
}

export function formatDateTime(
  value: string | number | Date | null | undefined
): string {
  const date = toValidDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat('en-GB', {
    ...DATE_OPTIONS,
    ...TIME_OPTIONS,
    timeZone: CLUB_TIMEZONE,
  })
    .format(date)
    .replace(/^(.*\d{4}) /, '$1, ')
}

/**
 * Format a Date as a date-only `YYYY-MM-DD` string using its LOCAL calendar
 * date. Date pickers produce a Date at local midnight; converting through UTC
 * (e.g. `toISOString()`) shifts it a day early for positive-offset timezones
 * like the club's (UTC+5/+6), so birthdays stored that way land a day before
 * the picked date.
 */
export function toDateOnlyString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function siteOrigin(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '')
}
