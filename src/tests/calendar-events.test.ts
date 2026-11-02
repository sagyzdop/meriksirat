import { describe, expect, it } from 'vitest'
import {
  buildCalendarEvent,
  equipmentLabel,
} from '@/lib/booking/calendar-events'

const club = (dateTime: string) => ({ dateTime, timeZone: 'Asia/Almaty' })

describe('equipmentLabel', () => {
  it('falls back to the equipment id', () => {
    expect(equipmentLabel('Sony A7', 4)).toBe('Sony A7')
    expect(equipmentLabel(null, 4)).toBe('Equipment 4')
    expect(equipmentLabel('', 9)).toBe('Equipment 9')
  })
})

describe('buildCalendarEvent', () => {
  it('create/add-items payload: ISO strings in club time', () => {
    expect(
      buildCalendarEvent({
        summary: 'Sony A7 - Booking',
        description: 'd',
        start: '2026-01-01T05:00:00.000Z',
        end: '2026-01-01T07:30:00.000Z',
      })
    ).toEqual({
      summary: 'Sony A7 - Booking',
      description: 'd',
      start: club('2026-01-01T10:00:00'),
      end: club('2026-01-01T12:30:00'),
    })
  })

  it('admin edit payload: status suffix in the title', () => {
    const event = buildCalendarEvent({
      summary: `${equipmentLabel(null, 4)} - Booking (${'booked'.toUpperCase()})`,
      description: 'd',
      start: '2026-01-01T05:00:00.000Z',
      end: '2026-01-01T07:00:00.000Z',
    })
    expect(event.summary).toBe('Equipment 4 - Booking (BOOKED)')
    expect(event.end).toEqual(club('2026-01-01T12:00:00'))
  })

  it('start payload: Date inputs, ACTIVE title', () => {
    const event = buildCalendarEvent({
      summary: 'Sony A7 (ACTIVE)',
      description: 'd',
      start: new Date('2026-01-01T05:10:00Z'),
      end: new Date('2026-01-01T07:00:00Z'),
    })
    expect(event.summary).toBe('Sony A7 (ACTIVE)')
    expect(event.start).toEqual(club('2026-01-01T10:10:00'))
    expect(event.end).toEqual(club('2026-01-01T12:00:00'))
  })

  it('return and extend payloads: titles pass through unchanged', () => {
    for (const summary of [
      'Sony A7 (RETURNED)',
      'Sony A7',
      'Sony A7 (BOOKED)',
    ]) {
      expect(
        buildCalendarEvent({
          summary,
          description: 'd',
          start: new Date('2026-01-01T05:00:00Z'),
          end: new Date('2026-01-01T06:00:00Z'),
        }).summary
      ).toBe(summary)
    }
  })

  it('overdue payload: UTC ISO strings, unchanged times', () => {
    expect(
      buildCalendarEvent({
        summary: 'Sony A7 (OVERDUE)',
        description: 'd',
        start: new Date('2026-01-01T05:00:00Z'),
        end: new Date('2026-01-01T07:00:00Z'),
        utc: true,
      })
    ).toEqual({
      summary: 'Sony A7 (OVERDUE)',
      description: 'd',
      start: { dateTime: '2026-01-01T05:00:00.000Z', timeZone: 'UTC' },
      end: { dateTime: '2026-01-01T07:00:00.000Z', timeZone: 'UTC' },
    })
  })
})
