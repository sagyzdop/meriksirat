import { useState } from 'react'
import { addMonths } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  formatGraduationMonth,
  graduationDateFromPicked,
  graduationPickerDate,
} from '@/lib/graduation-date'

interface GraduationFieldProps {
  value: string
  error: string | null
  prefilled: boolean
  onChange: (graduationDate: string) => void
}

export function GraduationField({
  value,
  error,
  prefilled,
  onChange,
}: GraduationFieldProps) {
  const [open, setOpen] = useState(false)
  const selected = graduationPickerDate(value)
  const first = addMonths(new Date(), 1)
  const startMonth = new Date(first.getFullYear(), first.getMonth(), 1)
  const endMonth = new Date(startMonth.getFullYear() + 12, 11, 1)
  const inRange =
    selected && selected >= startMonth && selected <= endMonth
      ? selected
      : undefined

  return (
    <div className="space-y-1.5">
      <Label htmlFor="graduation">When do you graduate?</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="graduation"
            variant="outline"
            data-empty={!value}
            aria-invalid={!!error}
            className="w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground"
          >
            <CalendarIcon />
            {value ? formatGraduationMonth(value) : 'Choose a month'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            defaultMonth={inRange ?? startMonth}
            selected={selected}
            onSelect={(date) => {
              onChange(graduationDateFromPicked(date))
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
      <p
        className={`text-sm ${error ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        {error ??
          (prefilled && value
            ? 'Filled in from your profile.'
            : 'Month and year. It must be in the future.')}
      </p>
    </div>
  )
}
