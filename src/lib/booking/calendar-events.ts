import { CLUB_TIMEZONE, toCalendarDateTime } from '@/lib/club-time'

export function equipmentLabel(
  name: string | null | undefined,
  id: number | null | undefined
): string {
  return name || `Equipment ${id}`
}

export function buildCalendarEvent(input: {
  summary: string
  description: string
  start: Date | string
  end: Date | string
  utc?: boolean
}) {
  const point = (value: Date | string) =>
    input.utc
      ? { dateTime: new Date(value).toISOString(), timeZone: 'UTC' }
      : { dateTime: toCalendarDateTime(value), timeZone: CLUB_TIMEZONE }

  return {
    summary: input.summary,
    description: input.description,
    start: point(input.start),
    end: point(input.end),
  }
}
