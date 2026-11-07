import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SaveBar } from '../components/save-bar'
import { SettingsSkeleton } from '../components/settings-skeleton'
import { useSaveSettings } from '../components/use-save-settings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import { minutesToTime, timeToMinutes } from '@/lib/booking/operating-hours'
import { cn } from '@/lib/utils'
import type { SettingsData } from '@/lib/admin/functions/settings'

function BookingsForm({ settings }: { settings: SettingsData }) {
  const [globalBookingNote, setGlobalBookingNote] = useState(
    settings.globalBookingNote || ''
  )
  const [startTime, setStartTime] = useState(
    minutesToTime(settings.operatingHoursStart || 0)
  )
  const [endTime, setEndTime] = useState(
    minutesToTime(settings.operatingHoursEnd ?? 1439)
  )
  const { save, pending } = useSaveSettings(['bookings'])

  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  const validationError = useMemo(() => {
    if (startTime === '' || endTime === '') {
      return 'Both operating hours times are required'
    }
    if (startMinutes >= endMinutes) {
      return 'Start time must be before end time'
    }
    return null
  }, [startTime, endTime, startMinutes, endMinutes])

  const bookableHours = validationError
    ? null
    : ((endMinutes - startMinutes) / 60).toFixed(1)
  const bookableSlots = validationError
    ? null
    : Math.round((endMinutes - startMinutes) / 30)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="globalNote">Global Booking Note</Label>
        <Textarea
          id="globalNote"
          placeholder="Enter a message that will be shown in all calendar events..."
          value={globalBookingNote}
          onChange={(e) => setGlobalBookingNote(e.target.value)}
          rows={3}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="operatingHoursStart">Operating Hours Start</Label>
          <Input
            id="operatingHoursStart"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="operatingHoursEnd">Operating Hours End</Label>
          <Input
            id="operatingHoursEnd"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>

      <div
        className={cn(
          'rounded-lg border px-4 py-3 text-sm',
          validationError
            ? 'border-red-200 bg-red-50 text-red-600'
            : 'border-border bg-muted/50 text-muted-foreground'
        )}
      >
        {validationError ? (
          validationError
        ) : (
          <>
            Open{' '}
            <span className="font-medium text-foreground">
              {minutesToTime(startMinutes)}
            </span>{' '}
            –{' '}
            <span className="font-medium text-foreground">
              {minutesToTime(endMinutes)}
            </span>{' '}
            · {bookableHours} bookable hours · {bookableSlots} 30-min slots
            available per day
          </>
        )}
      </div>

      <SaveBar
        pending={pending}
        disabled={validationError !== null}
        onSave={() =>
          save({
            globalBookingNote,
            operatingHoursStart: startMinutes,
            operatingHoursEnd: endMinutes,
          })
        }
      />
    </div>
  )
}

export function Page() {
  const { data: settings } = useQuery(adminDashboardQueries.settings())
  return settings ? <BookingsForm settings={settings} /> : <SettingsSkeleton />
}
