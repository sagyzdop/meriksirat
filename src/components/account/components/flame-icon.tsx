import { Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FlameIcon as FlameIconState } from '@/lib/flamekeeper/profile-copy'

const STATE_CLASS: Record<FlameIconState, string> = {
  flame: 'flame-icon-flame text-primary fill-primary/30',
  ember: 'flame-icon-ember text-primary',
  fading: 'text-muted-foreground',
  out: 'text-muted-foreground opacity-40',
}

interface FlameIconProps {
  state: FlameIconState
  className?: string
}

export function FlameIcon({ state, className }: FlameIconProps) {
  return (
    <Flame
      aria-hidden
      className={cn('flame-icon size-6', STATE_CLASS[state], className)}
    />
  )
}
