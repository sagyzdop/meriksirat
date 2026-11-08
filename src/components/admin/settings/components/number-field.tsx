import { Input } from '@/components/ui/input'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
} from '@/components/ui/item'
import { Label } from '@/components/ui/label'

interface NumberFieldProps {
  id: string
  label: string
  helper?: string
  value: string
  onChange: (value: string) => void
  min: number
  max?: number
  error?: string | null
}

export function NumberField({
  id,
  label,
  helper,
  value,
  onChange,
  min,
  max,
  error,
}: NumberFieldProps) {
  return (
    <Item variant="outline" size="sm">
      <ItemContent>
        <Label htmlFor={id}>{label}</Label>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : helper ? (
          <ItemDescription>{helper}</ItemDescription>
        ) : null}
      </ItemContent>
      <ItemActions>
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          className="w-28"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
        />
      </ItemActions>
    </Item>
  )
}

export function validateRange(
  raw: string,
  min: number,
  max: number,
  integer = true
): string | null {
  const value = Number(raw)
  if (raw.trim() === '' || !Number.isFinite(value)) return 'Enter a number'
  if (integer && !Number.isInteger(value)) return 'Enter a whole number'
  if (value < min || value > max) return `Must be between ${min} and ${max}`
  return null
}
