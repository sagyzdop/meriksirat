import { Input } from '@/components/ui/input'
import {
  graduationDateFromMonth,
  graduationMonthFromDate,
} from '@/lib/graduation-date'

interface GraduationMonthInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  'value' | 'onChange'
> {
  value: string
  onValueChange: (graduationDate: string) => void
}

export function GraduationMonthInput({
  value,
  onValueChange,
  ...props
}: GraduationMonthInputProps) {
  return (
    <Input
      type="month"
      {...props}
      value={graduationMonthFromDate(value)}
      onChange={(e) =>
        onValueChange(graduationDateFromMonth(e.target.value) ?? '')
      }
    />
  )
}
