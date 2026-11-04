// PROTOTYPE: floating variant switcher. Never part of the design being judged.
import { useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Option {
  key: string
  name: string
}

interface PrototypeSwitcherProps {
  variants: Array<Option>
  current: string
  onVariant: (key: string) => void
  states?: Array<Option>
  currentState?: string
  onState?: (key: string) => void
}

export function PrototypeSwitcher({
  variants,
  current,
  onVariant,
  states,
  currentState,
  onState,
}: PrototypeSwitcherProps) {
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current)
  )
  const step = (delta: number) =>
    onVariant(variants[(index + delta + variants.length) % variants.length].key)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }
      if (event.key === 'ArrowLeft') step(-1)
      if (event.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center gap-1 rounded-xl bg-neutral-950 px-2 py-2 text-xs text-white shadow-xl">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous variant"
          onClick={() => step(-1)}
          className="rounded p-1 hover:bg-white/20"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-44 text-center font-medium">
          {variants[index].key} ({variants[index].name})
        </span>
        <button
          type="button"
          aria-label="Next variant"
          onClick={() => step(1)}
          className="rounded p-1 hover:bg-white/20"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      {states && (
        <div className="flex flex-wrap justify-center gap-1">
          {states.map((state) => (
            <button
              key={state.key}
              type="button"
              onClick={() => onState?.(state.key)}
              className={
                state.key === currentState
                  ? 'rounded bg-white px-2 py-0.5 text-neutral-950'
                  : 'rounded px-2 py-0.5 hover:bg-white/20'
              }
            >
              {state.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
