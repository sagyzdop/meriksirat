import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { PLEDGE_CHOICES } from '@/lib/flamekeeper/pledge'

interface PledgeFieldProps {
  choice: string
  typed: string
  error: string | null
  onChoiceChange: (choice: string) => void
  onTypedChange: (typed: string) => void
}

export function PledgeField({
  choice,
  typed,
  error,
  onChoiceChange,
  onTypedChange,
}: PledgeFieldProps) {
  return (
    <div className="space-y-3">
      <Label id="pledge-label">How much can you lend?</Label>
      <RadioGroup
        aria-labelledby="pledge-label"
        value={typed ? '' : choice}
        onValueChange={(value) => {
          onTypedChange('')
          onChoiceChange(value)
        }}
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
      <div className="space-y-1.5">
        <Label htmlFor="pledge-more">Or pledge more (GB)</Label>
        <Input
          id="pledge-more"
          type="number"
          inputMode="decimal"
          min={0.5}
          step={0.5}
          placeholder="For example 10"
          value={typed}
          onChange={(e) => onTypedChange(e.target.value)}
          aria-invalid={!!error}
        />
      </div>
      <p
        className={`text-sm ${error ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        {error ?? 'At least 512 MB. You can change it later.'}
      </p>
    </div>
  )
}
