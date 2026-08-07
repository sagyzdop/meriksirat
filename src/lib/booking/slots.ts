/**
 * Generates the list of 30-minute slot labels ("HH:mm") covered by the
 * [start, end) booking period. Used to pre-select slots in the time slot picker.
 */
export function getBookingSlots(start: Date | string, end: Date | string): string[] {
  const startTime = new Date(start)
  const endTime = new Date(end)

  const slots: string[] = []
  const current = new Date(startTime)

  while (current < endTime) {
    const timeStr = `${current.getHours().toString().padStart(2, "0")}:${current
      .getMinutes()
      .toString()
      .padStart(2, "0")}`
    slots.push(timeStr)
    current.setMinutes(current.getMinutes() + 30)
  }

  return slots
}
