import { describe, expect, it } from 'vitest'
import { groupBookingRows } from '@/lib/telegram/group-rows'

const t = (n: number) => new Date(n)

describe('groupBookingRows', () => {
  it('groups item rows by booking in first-seen order', () => {
    const rows = [
      {
        bookingId: 2,
        startTime: t(1),
        endTime: t(2),
        status: 'booked',
        itemId: 10,
        equipmentName: 'A',
        itemStatus: 'booked',
      },
      {
        bookingId: 2,
        startTime: t(1),
        endTime: t(2),
        status: 'booked',
        itemId: 11,
        equipmentName: 'B',
        itemStatus: 'active',
      },
      {
        bookingId: 1,
        startTime: t(3),
        endTime: t(4),
        status: 'active',
        itemId: 12,
        equipmentName: 'C',
        itemStatus: 'active',
      },
    ]
    expect(groupBookingRows(rows)).toEqual([
      {
        id: 2,
        startTime: t(1),
        endTime: t(2),
        status: 'booked',
        items: [
          { itemId: 10, equipmentName: 'A', itemStatus: 'booked' },
          { itemId: 11, equipmentName: 'B', itemStatus: 'active' },
        ],
      },
      {
        id: 1,
        startTime: t(3),
        endTime: t(4),
        status: 'active',
        items: [{ itemId: 12, equipmentName: 'C', itemStatus: 'active' }],
      },
    ])
  })

  it('returns an empty list for no rows', () => {
    expect(groupBookingRows([])).toEqual([])
  })
})
