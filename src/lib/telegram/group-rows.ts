export interface BookingItemRow {
  bookingId: number
  startTime: Date
  endTime: Date
  status: string
  itemId: number
  equipmentName: string
  itemStatus: string
}

export interface GroupedBooking {
  id: number
  startTime: Date
  endTime: Date
  status: string
  items: Array<{ itemId: number; equipmentName: string; itemStatus: string }>
}

export function groupBookingRows(rows: BookingItemRow[]): GroupedBooking[] {
  const map = new Map<number, GroupedBooking>()
  for (const row of rows) {
    let entry = map.get(row.bookingId)
    if (!entry) {
      entry = {
        id: row.bookingId,
        startTime: row.startTime,
        endTime: row.endTime,
        status: row.status,
        items: [],
      }
      map.set(row.bookingId, entry)
    }
    entry.items.push({
      itemId: row.itemId,
      equipmentName: row.equipmentName,
      itemStatus: row.itemStatus,
    })
  }
  return [...map.values()]
}
