import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  graduationDateFromMonth,
  graduationMonthFromDate,
} from '@/lib/graduation-date'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

interface GraduationMonthInputProps {
  value: string
  onValueChange: (graduationDate: string) => void
  id?: string
  name?: string
  className?: string
  onBlur?: () => void
  'aria-invalid'?: boolean
}

export function GraduationMonthInput({
  value,
  onValueChange,
  id,
  className,
  onBlur,
  'aria-invalid': invalid,
}: GraduationMonthInputProps) {
  const current = graduationMonthFromDate(value)
  const [pickedMonth, setPickedMonth] = useState(current.slice(5))
  const [pickedYear, setPickedYear] = useState(current.slice(0, 4))

  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 14 }, (_, i) => String(thisYear - 1 + i))
  if (pickedYear && !years.includes(pickedYear)) years.push(pickedYear)
  years.sort()

  const change = (month: string, year: string) => {
    setPickedMonth(month)
    setPickedYear(year)
    if (month && year)
      onValueChange(graduationDateFromMonth(`${year}-${month}`) ?? '')
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <Select
        value={pickedMonth}
        onValueChange={(month) => change(month, pickedYear)}
      >
        <SelectTrigger
          id={id}
          className="flex-1"
          aria-invalid={invalid}
          onBlur={onBlur}
        >
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((name, i) => (
            <SelectItem key={name} value={String(i + 1).padStart(2, '0')}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={pickedYear}
        onValueChange={(year) => change(pickedMonth, year)}
      >
        <SelectTrigger
          className="w-28"
          aria-label="Year"
          aria-invalid={invalid}
          onBlur={onBlur}
        >
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          {years.map((year) => (
            <SelectItem key={year} value={year}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
