// PROTOTYPE ONLY: floating variant switcher. Hidden in production builds.
import { useEffect } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { FlamekeeperVariant } from './types'

const VARIANT_NAMES: Record<FlamekeeperVariant, string> = {
  A: 'Workbench',
  B: 'Split view',
  C: 'Operations top',
}

interface PrototypeSwitcherProps {
  current: FlamekeeperVariant
  onChange: (variant: FlamekeeperVariant) => void
}

export function PrototypeSwitcher({
  current,
  onChange,
}: PrototypeSwitcherProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="combobox"]'
        )
      ) {
        return
      }
      event.preventDefault()
      const order: FlamekeeperVariant[] = ['A', 'B', 'C']
      const index = order.indexOf(current)
      const next =
        event.key === 'ArrowRight'
          ? order[(index + 1) % order.length]
          : order[(index - 1 + order.length) % order.length]
      onChange(next)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [current, onChange])

  // The dev loop runs a production build (`npm run dev` builds, then starts
  // wrangler), so gate on the devtools flag rather than import.meta.env.PROD.
  if (import.meta.env.VITE_ENABLE_DEVTOOLS !== 'true') return null

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-foreground px-2 py-1 text-background shadow-lg"
      role="toolbar"
      aria-label="Prototype variant switcher"
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-background hover:bg-background/15 hover:text-background"
        onClick={() => {
          const order: FlamekeeperVariant[] = ['A', 'B', 'C']
          const index = order.indexOf(current)
          onChange(order[(index - 1 + order.length) % order.length])
        }}
        aria-label="Previous variant"
      >
        <ArrowLeft />
      </Button>
      <span className="min-w-44 text-center text-xs font-medium whitespace-nowrap">
        Prototype {current} · {VARIANT_NAMES[current]}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-background hover:bg-background/15 hover:text-background"
        onClick={() => {
          const order: FlamekeeperVariant[] = ['A', 'B', 'C']
          const index = order.indexOf(current)
          onChange(order[(index + 1) % order.length])
        }}
        aria-label="Next variant"
      >
        <ArrowRight />
      </Button>
    </div>
  )
}
