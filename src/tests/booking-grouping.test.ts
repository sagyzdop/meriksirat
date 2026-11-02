import { describe, expect, it } from 'vitest'
import { groupItemsByBooking } from '@/lib/booking/mappers'
import type { ItemRow } from '@/lib/booking/mappers'

const t = new Date('2026-01-01T00:00:00Z')

function parent(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    userId: 'u1',
    startTime: t,
    endTime: t,
    status: 'booked',
    userEventDetails: null,
    startedAt: null,
    createdAt: t,
    updatedAt: t,
    ...extra,
  }
}

function item(bookingId: number, itemId: number, eqId: number | null) {
  return {
    bookingId,
    itemId,
    equipmentId: 5,
    itemStatus: 'booked',
    gcalEventId: 'ev',
    returnedAt: null,
    itemCreatedAt: t,
    itemUpdatedAt: t,
    eqId,
    eqModelName: eqId ? 'Cam' : null,
    eqDescription: null,
    eqCategoryId: eqId ? 2 : null,
    eqImagePath: null,
    eqGcalId: eqId ? 'cal' : null,
    catId: eqId ? 2 : null,
    catName: eqId ? 'Cameras' : null,
  } satisfies ItemRow
}

describe('groupItemsByBooking', () => {
  it('keeps parent order and keeps bookings without items', () => {
    const result = groupItemsByBooking(
      [parent(3), parent(1), parent(2)],
      [item(1, 10, 5), item(2, 11, 5), item(2, 12, 5)]
    )
    expect(result.map((b) => b.id)).toEqual([3, 1, 2])
    expect(result[0].items).toEqual([])
    expect(result[1].items.map((i) => i.id)).toEqual([10])
    expect(result[2].items.map((i) => i.id)).toEqual([11, 12])
  })

  it('maps item and equipment fields', () => {
    const [b] = groupItemsByBooking([parent(1)], [item(1, 10, 5)])
    expect(b.items[0]).toEqual({
      id: 10,
      equipmentId: 5,
      status: 'booked',
      googleCalendarEventId: 'ev',
      returnedAt: null,
      createdAt: t,
      updatedAt: t,
      equipment: {
        id: 5,
        modelName: 'Cam',
        description: null,
        categoryId: 2,
        imagePath: null,
        googleCalendarId: 'cal',
        category: { id: 2, name: 'Cameras' },
      },
    })
  })

  it('uses null equipment when the equipment row is missing', () => {
    const [b] = groupItemsByBooking([parent(1)], [item(1, 10, null)])
    expect(b.items[0].equipment).toBeNull()
  })

  it('drops extra parent columns', () => {
    const [b] = groupItemsByBooking([parent(1, { sortEquipmentName: 'x' })], [])
    expect(b).not.toHaveProperty('sortEquipmentName')
  })
})
