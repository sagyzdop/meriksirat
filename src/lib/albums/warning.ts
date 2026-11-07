const WARNING_YEARS = 2

export function albumStorageWarning(eventDate: string, now: Date): boolean {
  const event = new Date(eventDate)
  if (Number.isNaN(event.getTime())) return false
  const threshold = new Date(event.getTime())
  threshold.setUTCFullYear(threshold.getUTCFullYear() + WARNING_YEARS)
  return now.getTime() > threshold.getTime()
}
