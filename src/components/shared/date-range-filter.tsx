import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import type { DateRange } from 'react-day-picker'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DateRangeFilterProps {
  from?: string
  to?: string
  className?: string
  onChange: (range: DateRange | undefined) => void
}

export function DateRangeFilter({
  from,
  to,
  className,
  onChange,
}: DateRangeFilterProps) {
  const fromDate = from ? new Date(from) : undefined
  const toDate = to ? new Date(to) : undefined
  const range: DateRange | undefined = fromDate
    ? { from: fromDate, to: toDate }
    : undefined

  const label = fromDate
    ? toDate
      ? `Date: ${format(fromDate, 'MMM d, yyyy')} – ${format(toDate, 'MMM d, yyyy')}`
      : `Date: from ${format(fromDate, 'MMM d, yyyy')}`
    : 'Date Range'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-empty={!fromDate}
          aria-label="Date range filter"
          className={cn(
            'data-[empty=true]:text-muted-foreground h-8 justify-start border-dashed',
            className
          )}
        >
          <CalendarIcon data-icon="inline-start" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-w-[calc(100vw-2rem)] p-0"
        align="start"
      >
        <Calendar
          mode="range"
          numberOfMonths={2}
          defaultMonth={fromDate}
          selected={range}
          onSelect={onChange}
          initialFocus
        />
        {range && (
          <div className="flex items-center justify-center border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(undefined)}
            >
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
