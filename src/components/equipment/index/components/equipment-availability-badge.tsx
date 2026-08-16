import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { bookingsQueries } from '@/lib/booking'
import { checkCalendarFreeBusy } from '@/lib/google/google-caledar'
import { buildAvailabilityWindow } from '../hooks/use-equipment-availability'
import {
  availabilityBadgeClass,
  availabilityBadgeLabel,
  getEquipmentAvailabilityStatus,
} from './availability-status'
import { Equipment } from './types'

interface EquipmentAvailabilityBadgeProps {
  equipment: Pick<Equipment, 'id' | 'googleCalendarId' | 'isActive'>
}

/**
 * Availability badge for the equipment detail page. Runs the same Google
 * Calendar free/busy check as the equipment cards (over the default next
 * bookable window) so the detail page badge always matches the card.
 */
export function EquipmentAvailabilityBadge({
  equipment,
}: EquipmentAvailabilityBadgeProps) {
  const { data: settings } = useQuery(bookingsQueries.settings())
  const window = useMemo(
    () =>
      buildAvailabilityWindow({
        operatingHoursStart: settings?.operatingHoursStart ?? 0,
        operatingHoursEnd: settings?.operatingHoursEnd ?? 1439,
      }),
    [settings?.operatingHoursStart, settings?.operatingHoursEnd]
  )

  const freeBusyQuery = useQuery({
    queryKey: [
      'equipment-availability',
      'detail',
      equipment.id,
      window.timeMin,
      window.timeMax,
    ],
    queryFn: () =>
      checkCalendarFreeBusy({
        data: {
          calendarId: equipment.googleCalendarId,
          timeMin: window.timeMin,
          timeMax: window.timeMax,
        },
      }),
  })

  const status = getEquipmentAvailabilityStatus({
    isActive: equipment.isActive,
    isChecking: freeBusyQuery.isPending,
    isBusy:
      (freeBusyQuery.data?.busy?.length ?? 0) > 0 || freeBusyQuery.isError,
  })

  return (
    <Badge className={availabilityBadgeClass[status]}>
      {availabilityBadgeLabel[status]}
    </Badge>
  )
}
