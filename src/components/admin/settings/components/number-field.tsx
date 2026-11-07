import { Input } from '@/components/ui/input'
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
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : helper ? (
        <p className="text-sm text-muted-foreground">{helper}</p>
      ) : null}
    </div>
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
