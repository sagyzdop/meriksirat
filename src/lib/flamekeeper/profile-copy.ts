import type { FlamekeeperState } from '@/lib/access/access-rules'
import { formatGb } from './rules'

export type FlameIcon = 'ember' | 'flame' | 'fading' | 'out'

export interface FlamekeeperPresentationInput {
  state: FlamekeeperState
  pledgedBytes: number
  usedBytes: number
}

export interface FlamekeeperPresentation {
  title: string
  description: string
  icon: FlameIcon
  action: 'become' | 'reconnect' | null
  pledge: { line: string; percent: number } | null
}

const INVITE: FlamekeeperPresentation = {
  title: 'Keep the flame alive',
  description: "Lend a little of your NU Drive to the club's albums.",
  icon: 'ember',
  action: 'become',
  pledge: null,
}

export function flamekeeperPresentation(
  flamekeeper: FlamekeeperPresentationInput | null
): FlamekeeperPresentation {
  if (!flamekeeper || flamekeeper.state === 'drained') return INVITE

  const percent =
    flamekeeper.pledgedBytes > 0
      ? Math.min(100, (flamekeeper.usedBytes / flamekeeper.pledgedBytes) * 100)
      : 0
  const pledge = {
    line: `${formatGb(flamekeeper.usedBytes)} of ${formatGb(flamekeeper.pledgedBytes)} pledged`,
    percent,
  }

  switch (flamekeeper.state) {
    case 'draining':
      return {
        title: 'Your flame is winding down',
        description:
          'Thank you for keeping it lit. Nothing to do on your side.',
        icon: 'fading',
        action: null,
        pledge,
      }
    case 'lost':
      return {
        title: 'We lost touch with your Drive',
        description: 'Reconnect within 7 days to keep your flame lit.',
        icon: 'out',
        action: 'reconnect',
        pledge,
      }
    default:
      return {
        title: "You're keeping the flame alive",
        description: 'Thank you for your service 🫡🇰🇿',
        icon: flamekeeper.usedBytes > 0 ? 'flame' : 'ember',
        action: null,
        pledge,
      }
  }
}
