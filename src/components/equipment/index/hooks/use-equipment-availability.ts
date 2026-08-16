import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { checkMultipleCalendarsFreeBusy } from '@/lib/google/google-caledar'
import { getCurrentlyRentedEquipmentIdsFn } from '@/lib/equipment/functions'
import {
  clubLocalToUtc,
  getNextBookableWindow,
  minutesToTime,
  timeToMinutes,
} from '@/lib/booking'
import type { Equipment } from '../components/types'

const MAX_CALENDARS_PER_REQUEST = 40

export interface AvailabilityWindow {
  timeMin: string
  timeMax: string
}

export interface AvailabilityWindowOptions {
  /** `YYYY-MM-DD` club-local start date (defaults to today) */
  startDate?: string
  /** `YYYY-MM-DD` club-local end date (defaults to start date) */
  endDate?: string
  /** `HH:mm` club-local start time (defaults to the next 30-min boundary) */
  startTime?: string
  /** `HH:mm` club-local end time (defaults to start time + 30 min) */
  endTime?: string
  operatingHoursStart?: number
  operatingHoursEnd?: number
}

/**
 * Builds the UTC time window for an availability check.
 *
 * Browse mode: the window comes from the date/time filter ranges, defaulting
 * to today plus the nearest 30-minute bookable window (see
 * `getNextBookableWindow`).
 * Add-to-booking mode: the window is the booking's own start/end time.
 */
export function buildAvailabilityWindow(
  options: AvailabilityWindowOptions = {}
): AvailabilityWindow {
  const defaults = getNextBookableWindow(
    options.operatingHoursStart ?? 0,
    options.operatingHoursEnd ?? 1439
  )
  const startDate = options.startDate ?? defaults.dateKey
  const endDate = options.endDate ?? startDate
  const resolvedStartTime = options.startTime ?? defaults.startTime
  const resolvedEndTime =
    options.endTime ?? minutesToTime(timeToMinutes(resolvedStartTime) + 30)
  return {
    timeMin: clubLocalToUtc(startDate, resolvedStartTime).toISOString(),
    timeMax: clubLocalToUtc(endDate, resolvedEndTime).toISOString(),
  }
}

interface UseEquipmentAvailabilityOptions {
  equipment: Equipment[]
  window: AvailabilityWindow | null
}

/**
 * Fetches free/busy for every equipment calendar over the given window and
 * exposes which equipment ids are busy (unavailable) during it. An item is
 * treated as busy when EITHER the calendar is busy over the window OR D1 says
 * it is currently checked out (status `active`/`overdue`) — so equipment that
 * is rented out right now never shows as available.
 */
export function useEquipmentAvailability({
  equipment,
  window,
}: UseEquipmentAvailabilityOptions) {
  const freeBusyQuery = useQuery({
    queryKey: ['equipment-availability', window?.timeMin, window?.timeMax],
    enabled: window !== null,
    queryFn: async () => {
      const calendars = equipment
        .map((item) => item.googleCalendarId)
        .filter((id): id is string => Boolean(id))
      const busyCalendarIds = new Set<string>()
      const chunks: string[][] = []
      for (let i = 0; i < calendars.length; i += MAX_CALENDARS_PER_REQUEST) {
        chunks.push(calendars.slice(i, i + MAX_CALENDARS_PER_REQUEST))
      }
      await Promise.all(
        chunks.map(async (chunk) => {
          const result = await checkMultipleCalendarsFreeBusy({
            data: {
              equipmentCalendarIds: chunk,
              timeMin: window!.timeMin,
              timeMax: window!.timeMax,
            },
          })
          for (const [calendarId, info] of Object.entries(result)) {
            if ((info.busy ?? []).length > 0 || info.error) {
              busyCalendarIds.add(calendarId)
            }
          }
        })
      )
      return busyCalendarIds
    },
  })

  const rentedOutQuery = useQuery({
    queryKey: ['equipment-active-bookings'],
    queryFn: async () => getCurrentlyRentedEquipmentIdsFn(),
  })

  const busyByEquipmentId = useMemo(() => {
    const map = new Map<number, boolean>()
    for (const item of equipment) {
      const calendarBusy =
        freeBusyQuery.data?.has(item.googleCalendarId) ?? false
      const rentedOut = rentedOutQuery.data?.includes(item.id) ?? false
      map.set(item.id, calendarBusy || rentedOut)
    }
    return map
  }, [equipment, freeBusyQuery.data, rentedOutQuery.data])

  return {
    busyByEquipmentId,
    isChecking:
      (window !== null && freeBusyQuery.data === undefined) ||
      rentedOutQuery.data === undefined,
    refetch: async () => {
      const [result] = await Promise.all([
        freeBusyQuery.refetch(),
        rentedOutQuery.refetch(),
      ])
      return result
    },
  }
}
