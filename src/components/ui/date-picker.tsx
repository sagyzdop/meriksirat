import type * as React from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { formatDate } from '@/lib/format'

interface DatePickerProps extends Pick<
  React.ComponentProps<typeof Calendar>,
  'captionLayout' | 'startMonth' | 'endMonth' | 'defaultMonth'
> {
  id?: string
  date?: Date
  onSelect?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
}

export function DatePicker({
  date,
  onSelect,
  placeholder = 'Pick a date',
  className,
  id,
  ...calendarProps
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          data-empty={!date}
          className={cn(
            'data-[empty=true]:text-muted-foreground h-8 justify-start text-left font-normal',
            className
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          {date ? formatDate(date) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onSelect}
          initialFocus
          {...calendarProps}
        />
      </PopoverContent>
    </Popover>
  )
}
