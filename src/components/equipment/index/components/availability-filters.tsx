import { Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DatePicker } from '@/components/ui/date-picker'

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
  dateKey?: string
  time?: string
  availableOnly: boolean
  onDateChange: (dateKey?: string) => void
  onTimeChange: (time?: string) => void
  onAvailableOnlyChange: (value: boolean) => void
}

export function AvailabilityFilters({
  dateKey,
  time,
  availableOnly,
  onDateChange,
  onTimeChange,
  onAvailableOnlyChange,
}: AvailabilityFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DatePicker
        date={dateKeyToDate(dateKey)}
        onSelect={(date) =>
          onDateChange(date ? dateToDateKey(date) : undefined)
        }
        placeholder="Pick a date"
      />
      <div className="relative">
        <Clock
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="time"
          value={time ?? ''}
          onChange={(event) => onTimeChange(event.target.value || undefined)}
          aria-label="Availability time"
          className="h-8 w-32 pl-8"
        />
      </div>
      <div className="flex h-8 items-center gap-2 rounded-md border px-2.5">
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
