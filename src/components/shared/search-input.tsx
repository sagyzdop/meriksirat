import * as React from 'react'
import { useDebouncer } from '@tanstack/react-pacer'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  delay?: number
}

/**
 * Debounced search box. The input owns what the user types; the `value` prop
 * only overwrites it when it changes to something the user did not type
 * (Reset, back/forward navigation). Echoes of values we sent, including late
 * ones from superseded navigations and ones the URL schema trimmed, never
 * touch the input, so typing is never clobbered.
 */
export function SearchInput({
  value = '',
  onChange,
  placeholder,
  className,
  delay = 300,
}: SearchInputProps) {
  const [localValue, setLocalValue] = React.useState(value)
  const inFlightRef = React.useRef([value.trim()])
  const onChangeRef = React.useRef(onChange)

  React.useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const debouncer = useDebouncer(
    (next: string) => {
      const trimmed = next.trim()
      if (trimmed === inFlightRef.current.at(-1)) return
      inFlightRef.current.push(trimmed)
      onChangeRef.current(trimmed)
    },
    { wait: delay }
  )

  React.useEffect(() => {
    const trimmed = value.trim()
    const echoAt = inFlightRef.current.indexOf(trimmed)
    if (echoAt !== -1) {
      inFlightRef.current = inFlightRef.current.slice(echoAt)
      return
    }
    debouncer.cancel()
    inFlightRef.current = [trimmed]
    setLocalValue(value)
  }, [value, debouncer])

  const update = (next: string) => {
    setLocalValue(next)
    debouncer.maybeExecute(next)
  }

  return (
    <div className={cn('relative', className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        type="search"
        placeholder={placeholder}
        value={localValue}
        onChange={(event) => update(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') debouncer.flush()
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="search"
        className="h-full w-full pr-8 pl-8 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {localValue && (
        <button
          type="button"
          onClick={() => {
            update('')
            debouncer.flush()
          }}
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 transition-colors"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
