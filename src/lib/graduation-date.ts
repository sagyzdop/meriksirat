import { isValidGraduationDate } from '@/lib/flamekeeper/rules'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/

export function graduationDateFromMonth(month: string): string | null {
  const match = MONTH.exec(month)
  return match ? `${match[1]}-${match[2]}-01` : null
}

export function graduationMonthFromDate(
  date: string | null | undefined
): string {
  return date && DATE.test(date) ? date.slice(0, 7) : ''
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function graduationDateFromPicked(picked: Date | undefined): string {
  if (!picked || Number.isNaN(picked.getTime())) return ''
  const year = String(picked.getFullYear()).padStart(4, '0')
  const month = String(picked.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

export function graduationPickerDate(
  date: string | null | undefined
): Date | undefined {
  if (!date || !DATE.test(date)) return undefined
  return new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, 1)
}

export function formatGraduationMonth(date: string | null | undefined): string {
  if (!date || !DATE.test(date)) return ''
  const name = MONTH_NAMES[Number(date.slice(5, 7)) - 1]
  return name ? `${name} ${date.slice(0, 4)}` : ''
}

export function legacyYearToGraduationDate(year: number): string {
  return `${year}-06-01`
}

export function classOfYear(date: string | null | undefined): number | null {
  if (!date || !DATE.test(date)) return null
  return Number(date.slice(0, 4))
}

export function graduationDateError(
  date: string,
  options: { isFlamekeeper: boolean; current?: string | null },
  now: Date = new Date()
): string | null {
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return 'Enter a valid graduation month'
  }
  if (!options.isFlamekeeper || date === options.current) return null
  return isValidGraduationDate(date, now)
    ? null
    : 'Expected graduation date must be in the future'
}
