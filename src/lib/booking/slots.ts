/**
 * Generates the list of 30-minute slot labels ("HH:mm") covered by the
 * [start, end) booking period. Used to pre-select slots in the time slot picker.
 *
 * The start is floored down to the nearest 30-minute boundary so the generated
 * labels align with the picker's :00 / :30 slots.
 */
export function getBookingSlots(
  start: Date | string,
  end: Date | string
): string[] {
  const startTime = new Date(start)
  const endTime = new Date(end)

  const flooredStart = new Date(startTime)
  flooredStart.setMinutes(Math.floor(flooredStart.getMinutes() / 30) * 30, 0, 0)

  const slots: string[] = []
  const current = new Date(flooredStart)

  while (current < endTime) {
    const timeStr = `${current.getHours().toString().padStart(2, '0')}:${current
      .getMinutes()
      .toString()
      .padStart(2, '0')}`
    slots.push(timeStr)
    current.setMinutes(current.getMinutes() + 30)
  }

  return slots
}
