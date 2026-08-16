import { Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DateRangeFilter } from '@/components/shared/date-range-filter'
import { minutesToTime, timeToMinutes } from '@/lib/booking'

function dateKeyToDate(dateKey?: string): Date | undefined {
  if (!dateKey) return undefined
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function dateToDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface AvailabilityFiltersProps {
  startDate?: string
  endDate?: string
  startTime?: string
  endTime?: string
  defaultStartTime: string
  defaultEndTime: string
  availableOnly: boolean
  onStartDateChange: (value?: string) => void
  onEndDateChange: (value?: string) => void
  onStartTimeChange: (value?: string) => void
  onEndTimeChange: (value?: string) => void
  onAvailableOnlyChange: (value: boolean) => void
}

export function AvailabilityFilters({
  startDate,
  endDate,
  startTime,
  endTime,
  defaultStartTime,
  defaultEndTime,
  availableOnly,
  onStartDateChange,
  onEndDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onAvailableOnlyChange,
}: AvailabilityFiltersProps) {
  const shownStartTime = startTime ?? defaultStartTime
  const shownEndTime =
    endTime ??
    (startTime ? minutesToTime(timeToMinutes(startTime) + 30) : defaultEndTime)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DateRangeFilter
        from={startDate ? dateKeyToDate(startDate)!.toISOString() : undefined}
        to={endDate ? dateKeyToDate(endDate)!.toISOString() : undefined}
        onChange={(range) => {
          onStartDateChange(range?.from ? dateToDateKey(range.from) : undefined)
          onEndDateChange(range?.to ? dateToDateKey(range.to) : undefined)
        }}
        className="w-full sm:w-auto"
      />
      <div className="relative">
        <Clock
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="time"
          value={shownStartTime}
          onChange={(event) =>
            onStartTimeChange(event.target.value || undefined)
          }
          aria-label="Availability start time"
          className="h-8 w-32 pl-8"
        />
      </div>
      <span className="text-muted-foreground" aria-hidden="true">
        –
      </span>
      <div className="relative">
        <Input
          type="time"
          value={shownEndTime}
          onChange={(event) => onEndTimeChange(event.target.value || undefined)}
          aria-label="Availability end time"
          className="h-8 w-32 pl-8"
        />
      </div>
      <div className="flex h-8 items-center gap-2">
        <Switch
          id="available-only"
          size="sm"
          checked={availableOnly}
          onCheckedChange={onAvailableOnlyChange}
        />
        <Label htmlFor="available-only" className="cursor-pointer text-sm">
          Available only
        </Label>
      </div>
    </div>
  )
}
