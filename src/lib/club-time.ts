export const CLUB_TIMEZONE = 'Asia/Almaty'

export function formatClubTime(date: Date, hour12: boolean): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12,
    timeZone: CLUB_TIMEZONE,
  })
}

export function formatLongDate(
  date: Date | null,
  timeZone: string = CLUB_TIMEZONE
): string {
  if (!date) return ''
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  })
}
