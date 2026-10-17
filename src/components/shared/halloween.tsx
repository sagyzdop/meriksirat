import { useEffect } from 'react'

/**
 * Loads halloween.js. It auto-inits on import (watching `<body>` for the
 * `halloween` class), so it must never be a static import: `<body>` does not
 * exist during SSR, and this module is client-reachable.
 *
 * Both the master class and the Oct 1 - Nov 11 window are set statically on
 * <body> in src/routes/__root.tsx; the library does the date gating.
 */
export function HalloweenDecorations() {
  useEffect(() => {
    void import('halloween.js')
  }, [])

  return null
}
