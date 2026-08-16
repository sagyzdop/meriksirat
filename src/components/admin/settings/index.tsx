import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { updateSettingsFn } from '@/lib/admin/functions/settings'
import { minutesToTime, timeToMinutes } from '@/lib/booking/functions/settings'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from '@tanstack/react-router'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { cn } from '@/lib/utils'

interface SettingsData {
  id: string
  globalBookingNote: string | null
  birthdaysCalendarId: string | null
  operatingHoursStart: number | null
  operatingHoursEnd: number | null
  createdAt: Date | null
  updatedAt: Date | null
}

interface PageProps {
  settings: SettingsData
}

export function Page({ settings }: PageProps) {
  const router = useRouter()

  const [globalBookingNote, setGlobalBookingNote] = useState(
    settings?.globalBookingNote || ''
  )
  const [birthdaysCalendarId, setBirthdaysCalendarId] = useState(
    settings?.birthdaysCalendarId || ''
  )
  const [startTime, setStartTime] = useState(
    minutesToTime(settings?.operatingHoursStart || 0)
  )
  const [endTime, setEndTime] = useState(
    minutesToTime(settings?.operatingHoursEnd ?? 1439)
  )
  const [isSaving, setIsSaving] = useState(false)

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

  const handleSave = async () => {
    if (validationError) return
    setIsSaving(true)
    try {
      await updateSettingsFn({
        data: {
          globalBookingNote,
          birthdaysCalendarId,
          operatingHoursStart: startMinutes,
          operatingHoursEnd: endMinutes,
        },
      })
      toast.success('Settings updated successfully')
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update settings'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const bookableHours = validationError
    ? null
    : ((endMinutes - startMinutes) / 60).toFixed(1)
  const bookableSlots = validationError
    ? null
    : Math.round((endMinutes - startMinutes) / 30)

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Manage system settings and configurations"
      />

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

        <div className="space-y-2">
          <Label htmlFor="birthdaysCalendarId">Birthdays Calendar ID</Label>
          <Input
            id="birthdaysCalendarId"
            type="text"
            placeholder="c_xxxxx@group.calendar.google.com"
            value={birthdaysCalendarId}
            onChange={(e) => setBirthdaysCalendarId(e.target.value)}
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

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving || validationError !== null}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </PageContainer>
  )
}
