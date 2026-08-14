/**
 * Shared availability-check helpers for booking server functions.
 */

export interface BusyPeriod {
  start: string
  end: string
}

/**
 * Removes a booking's own calendar events from a free/busy result.
 *
 * Editing a booking checks availability before its calendar events have been
 * moved, so without this exclusion the booking's own event is reported as a
 * conflict with itself whenever the new window overlaps the current one.
 *
 * A busy period is treated as the booking's own event when it falls entirely
 * inside the current event period. No other event can overlap that period, so
 * any remaining busy periods are genuine conflicts.
 */
export function excludeOwnBookingPeriod(
  busy: BusyPeriod[],
  ownStart: Date | string,
  ownEnd: Date | string
): BusyPeriod[] {
  const start = new Date(ownStart).getTime()
  const end = new Date(ownEnd).getTime()

  return busy.filter((period) => {
    const periodStart = new Date(period.start).getTime()
    const periodEnd = new Date(period.end).getTime()
    return !(periodStart >= start && periodEnd <= end)
  })
}
