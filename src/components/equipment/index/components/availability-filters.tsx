import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
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
  date?: string
  startTime?: string
  endTime?: string
  defaultStartTime: string
  defaultEndTime: string
  operatingHoursStart: number
  operatingHoursEnd: number
  availableOnly: boolean
  onDateChange: (value?: string) => void
  onStartTimeChange: (value?: string) => void
  onEndTimeChange: (value?: string) => void
  onAvailableOnlyChange: (value: boolean) => void
}

export function AvailabilityFilters({
  date,
  startTime,
  endTime,
  defaultStartTime,
  defaultEndTime,
  operatingHoursStart,
  operatingHoursEnd,
  availableOnly,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onAvailableOnlyChange,
}: AvailabilityFiltersProps) {
  // The date filter defaults to today (club-local) so the calendar and the
  // button always show a concrete date even before the user picks one.
  const todayKey = getClubLocalParts(new Date()).dateKey
  const effectiveDate = date ?? todayKey
  const selectedDate = dateKeyToDate(effectiveDate)!

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Availability
      </span>
      <div className="flex w-full flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              data-empty={!date}
              aria-label="Availability date filter"
              className={cn(
                'data-[empty=true]:text-muted-foreground h-8 max-w-full justify-start border-dashed',
                'w-full md:w-auto'
              )}
            >
              <CalendarIcon data-icon="inline-start" />
              <span className="min-w-0 flex-1 truncate text-left">
                Date: {format(selectedDate, 'MMM d, yyyy')}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto max-w-[calc(100vw-2rem)] p-0"
            align="start"
          >
            <Calendar
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate}
              onSelect={(value) =>
                onDateChange(value ? dateToDateKey(value) : undefined)
              }
              initialFocus
              className="max-w-full"
              disabled={(date) => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                return date < today
              }}
            />
            {date && (
              <div className="flex items-center justify-center border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDateChange(undefined)}
                >
                  Clear
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
        <TimeRangePicker
          startTime={startTime}
          endTime={endTime}
          defaultStartTime={defaultStartTime}
          defaultEndTime={defaultEndTime}
          startDate={effectiveDate}
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
