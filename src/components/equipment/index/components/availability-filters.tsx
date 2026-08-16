import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DateRangeFilter } from '@/components/shared/date-range-filter'
import { TimeRangePicker } from './time-range-picker'
import { getClubLocalParts } from '@/lib/booking'

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
  operatingHoursStart: number
  operatingHoursEnd: number
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
  operatingHoursStart,
  operatingHoursEnd,
  availableOnly,
  onStartDateChange,
  onEndDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onAvailableOnlyChange,
}: AvailabilityFiltersProps) {
  // The date filter defaults to today (club-local) so the calendar and the
  // button always show a concrete date even before the user picks one.
  const todayKey = getClubLocalParts(new Date()).dateKey
  const effectiveStartDate = startDate ?? todayKey
  const effectiveEndDate = endDate ?? todayKey

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Availability
      </span>
      <div className="flex w-full flex-wrap items-center gap-2">
        <DateRangeFilter
          from={dateKeyToDate(effectiveStartDate)!.toISOString()}
          to={dateKeyToDate(effectiveEndDate)!.toISOString()}
          onChange={(range) => {
            onStartDateChange(
              range?.from ? dateToDateKey(range.from) : undefined
            )
            onEndDateChange(range?.to ? dateToDateKey(range.to) : undefined)
          }}
          disablePastDates
          className="w-full md:w-auto"
        />
        <TimeRangePicker
          startTime={startTime}
          endTime={endTime}
          defaultStartTime={defaultStartTime}
          defaultEndTime={defaultEndTime}
          startDate={effectiveStartDate}
          operatingHoursStart={operatingHoursStart}
          operatingHoursEnd={operatingHoursEnd}
          onStartTimeChange={onStartTimeChange}
          onEndTimeChange={onEndTimeChange}
          className="w-full md:w-auto"
        />
        <div className="flex h-8 items-center gap-2">
          <Switch
            id="available-only"
            size="sm"
            checked={availableOnly}
            onCheckedChange={onAvailableOnlyChange}
          />
          <Label htmlFor="available-only" className="cursor-pointer text-sm">
            Show Available Only
          </Label>
        </div>
      </div>
    </div>
  )
}
