import * as React from 'react'

export interface UseZoomReturn {
  scale: number
  translate: { x: number; y: number }
  resetZoom: () => void
  zoomIn: () => void
}

export function useZoom(): UseZoomReturn {
  const [scale, setScale] = React.useState(1)
  const [translate, setTranslate] = React.useState({ x: 0, y: 0 })

  const resetZoom = React.useCallback(() => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }, [])

  const zoomIn = React.useCallback(() => {
    setScale(2.5)
    setTranslate({ x: 0, y: 0 })
  }, [])

  return { scale, translate, resetZoom, zoomIn }
}
