// PROTOTYPE: the lucide fire icon, styled per status. ember = idle, flame = keeping, fading = leaving, out = lost.
import { Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FlameState = 'ember' | 'flame' | 'fading' | 'out'

const STYLES = `
@keyframes proto-flicker { 0%,100% { transform: scaleY(1) scaleX(1) } 35% { transform: scaleY(1.04) scaleX(.97) } 70% { transform: scaleY(.97) scaleX(1.02) } }
@keyframes proto-breathe { 0%,100% { opacity: .5 } 50% { opacity: .85 } }
.proto-flame { transform-origin: 50% 100%; }
.proto-flame-flame { animation: proto-flicker 2.8s ease-in-out infinite; }
.proto-flame-ember { animation: proto-breathe 4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .proto-flame { animation: none !important; } }
`

const STATE_CLASS: Record<FlameState, string> = {
  flame: 'text-primary fill-primary/30',
  ember: 'text-primary',
  fading: 'text-muted-foreground',
  out: 'text-muted-foreground opacity-40',
}

interface FlameMotifProps {
  state: FlameState
  size?: number
  className?: string
}

export function FlameMotif({ state, size = 24, className }: FlameMotifProps) {
  return (
    <span className={cn('inline-flex', className)} aria-hidden>
      <style>{STYLES}</style>
      <Flame
        size={size}
        className={cn(
          'proto-flame',
          `proto-flame-${state}`,
          STATE_CLASS[state]
        )}
      />
    </span>
  )
}
