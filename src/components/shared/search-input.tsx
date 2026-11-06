import * as React from 'react'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'

interface SearchInputProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  delay?: number
}

export function SearchInput({
  value = '',
  onChange,
  placeholder,
  className,
  delay = 300,
}: SearchInputProps) {
  const [localValue, setLocalValue] = React.useState(value)
  const debouncedValue = useDebounce(localValue, delay)
  const valueRef = React.useRef(value)
  const onChangeRef = React.useRef(onChange)

  React.useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  React.useEffect(() => {
    valueRef.current = value
    setLocalValue(value)
  }, [value])

  React.useEffect(() => {
    if (debouncedValue === valueRef.current) return
    onChangeRef.current(debouncedValue)
  }, [debouncedValue])

  return (
    <Input
      placeholder={placeholder}
      value={localValue}
      onChange={(event) => setLocalValue(event.target.value)}
      className={className}
    />
  )
}
