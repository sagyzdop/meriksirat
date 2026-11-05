import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { PLEDGE_CHOICES } from '@/lib/flamekeeper/pledge'

interface PledgePickerProps {
  value: string
  onChange: (value: string) => void
}

export function PledgePicker({ value, onChange }: PledgePickerProps) {
  return (
    <RadioGroup
      aria-label="Pledge"
      value={value}
      onValueChange={onChange}
      className="grid-cols-3 gap-2"
    >
      {PLEDGE_CHOICES.map((option) => (
        <Label
          key={option.value}
          htmlFor={`pledge-${option.value}`}
          className="h-10 cursor-pointer items-center justify-center rounded-md border text-sm font-medium shadow-xs transition-colors hover:bg-accent has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary has-data-[state=checked]:text-primary-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
        >
          <RadioGroupItem
            id={`pledge-${option.value}`}
            value={option.value}
            className="sr-only"
          />
          {option.label}
        </Label>
      ))}
    </RadioGroup>
  )
}
