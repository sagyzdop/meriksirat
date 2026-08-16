import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { checkMultipleCalendarsFreeBusy } from '@/lib/google/google-caledar'
import { clubLocalToUtc, getClubLocalParts, minutesToTime } from '@/lib/booking'
import type { Equipment } from '../components/types'

const MAX_CALENDARS_PER_REQUEST = 40

export interface AvailabilityWindow {
  timeMin: string
  timeMax: string
}

/**
 * Builds the UTC time window for an availability check.
 *
 * Browse mode: the window comes from the date/time filters, defaulting to
 * today plus the next 30-minute slot boundary (rolled over to 00:00 tomorrow
 * when today has fewer than 30 minutes left).
 * Add-to-booking mode: the window is the booking's own start/end time.
 */
export function buildAvailabilityWindow(
  dateKey?: string,
  time?: string
): AvailabilityWindow | null {
  const resolvedDate = dateKey ?? getClubLocalParts(new Date()).dateKey
  if (!time) {
    const nowMinutes = getClubLocalParts(new Date()).minutes
    const boundary = Math.ceil(nowMinutes / 30) * 30
    if (boundary > 1439) {
      const nextDay = new Date(
        clubLocalToUtc(resolvedDate, '00:00').getTime() + 24 * 60 * 60 * 1000
      )
      return {
        timeMin: clubLocalToUtc(
          getClubLocalParts(nextDay).dateKey,
          '00:00'
        ).toISOString(),
        timeMax: clubLocalToUtc(
          getClubLocalParts(nextDay).dateKey,
          '00:30'
        ).toISOString(),
      }
    }
    return {
      timeMin: clubLocalToUtc(
        resolvedDate,
        minutesToTime(boundary)
      ).toISOString(),
      timeMax: clubLocalToUtc(
        resolvedDate,
        minutesToTime(boundary + 30)
      ).toISOString(),
    }
  }
  const start = clubLocalToUtc(resolvedDate, time)
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  return { timeMin: start.toISOString(), timeMax: end.toISOString() }
}

interface UseEquipmentAvailabilityOptions {
  equipment: Equipment[]
  window: AvailabilityWindow | null
}

/**
 * Fetches free/busy for every equipment calendar over the given window and
 * exposes which equipment ids are busy (unavailable) during it.
 */
export function useEquipmentAvailability({
  equipment,
  window,
}: UseEquipmentAvailabilityOptions) {
  const query = useQuery({
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
            if ((info.busy ?? []).length > 0) busyCalendarIds.add(calendarId)
          }
        })
      )
      return busyCalendarIds
    },
  })

  const busyByEquipmentId = useMemo(() => {
    const map = new Map<number, boolean>()
    for (const item of equipment) {
      map.set(item.id, query.data?.has(item.googleCalendarId) ?? false)
    }
    return map
  }, [equipment, query.data])

  return {
    busyByEquipmentId,
    isChecking: window !== null && query.data === undefined,
    refetch: query.refetch,
  }
}
