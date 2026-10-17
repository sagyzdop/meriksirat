import { useEffect, useRef } from 'react'
import type { LetItGo as LetItGoInstance } from 'let-it-go'

/** DD-MM, the same format halloween.js uses for its season window. */
const WINDOW_RE = /^(\d{1,2})-(\d{1,2})$/

// Feb allows 29 so that 29-02 clamps to 28-02 outside leap years, matching
// halloween.js. Everything else is validated strictly.
const MAX_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function daysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** `DD-MM` -> a monotonically increasing number, or null if malformed. */
function parseBound(value: string | undefined, year: number): number | null {
  const match = value?.trim().match(WINDOW_RE)
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2]) - 1
  if (month < 0 || month > 11 || day < 1 || day > MAX_DAYS[month]) return null

  return month * 31 + Math.min(day, daysInMonth(month, year))
}

/**
 * Mirrors halloween.js's season gate: read `data-snow-start` / `data-snow-end`
 * off <body> and stay dormant outside the window. Handles windows that wrap the
 * year boundary (a Dec -> Feb window) and fails open, so a missing or
 * malformed value means "all year" rather than "never".
 */
export function isInSnowSeason(
  now: Date,
  start: string | undefined,
  end: string | undefined
): boolean {
  const year = now.getFullYear()
  const from = parseBound(start, year)
  const to = parseBound(end, year)
  if (from === null || to === null) return true

  const today = now.getMonth() * 31 + now.getDate()
  // Dec 1 -> Feb 28 wraps: start > end.
  return from <= to
    ? today >= from && today <= to
    : today >= from || today <= to
}

export function Snowfall() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const { snowStart, snowEnd } = document.body.dataset
    if (!isInSnowSeason(new Date(), snowStart, snowEnd)) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const dark = document.documentElement.classList.contains('dark')

    let snow: LetItGoInstance | undefined
    let cancelled = false

    // Dynamic so the renderer only ships in its own chunk, and so this
    // client-reachable module never imports it at module scope.
    void import('let-it-go').then(({ LetItGo }) => {
      if (cancelled) return

      snow = new LetItGo({
        root,
        number: 140,
        // px per frame at a fixed 30fps; the library default is [1, 5].
        velocityYRange: [0.2, 0.8],
        velocityXRange: [-0.3, 0.3],
        radiusRange: [0.6, 1.8],
        color: dark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(40, 40, 45, 0.35)',
      })
    })

    return () => {
      cancelled = true
      snow?.clear()
    }
  }, [])

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40"
    />
  )
}
