import * as React from 'react'
import { ImageOff } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { acquireImageSlot } from '@/lib/albums/image-gate'

const MAX_RETRIES = 5

interface PhotoImageProps extends React.ComponentProps<'img'> {
  containerClassName?: string
  fit?: 'cover' | 'contain'
}

/**
 * Image with a shimmer placeholder while loading, retry-with-backoff on
 * failure, and global concurrency limiting.
 *
 * Google's Drive CDN (`lh3.googleusercontent.com`) rate-limits anonymous
 * image requests based on the Referer header and throttles bursts with 429s,
 * which makes images fail unpredictably ("show then gray out"). `no-referrer`
 * hides the app origin so the CDN treats each request as a direct visit, and
 * the shared gate keeps bursts small enough to stay under the limit. Requests
 * are re-queued after a failed attempt so the retry benefits from both.
 *
 * - `fit="cover"` (default): fills its container (use inside an aspect-ratio
 *   wrapper), `object-cover`.
 * - `fit="contain"`: sized by the image itself, `object-contain` (lightbox).
 */
export function PhotoImage({
  containerClassName,
  className,
  alt = '',
  src,
  fit = 'cover',
  ...props
}: PhotoImageProps) {
  const [attempt, setAttempt] = React.useState(0)
  const [loaded, setLoaded] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const [currentSrc, setCurrentSrc] = React.useState<string | null>(null)
  const timerRef = React.useRef<number | null>(null)
  const releaseRef = React.useRef<(() => void) | null>(null)

  const releaseSlot = React.useCallback(() => {
    releaseRef.current?.()
    releaseRef.current = null
  }, [])

  React.useEffect(() => {
    setAttempt(0)
    setLoaded(false)
    setFailed(false)
  }, [src])

  // Wait for a concurrency slot before attaching the URL, then request it.
  // The slot is held only for the fetch (load, final error, or unmount) so a
  // successful load frees the slot for the next queued image. Retrying
  // (attempt++) releases the previous slot and re-queues.
  React.useEffect(() => {
    let cancelled = false
    releaseRef.current = null
    setCurrentSrc(null)

    acquireImageSlot().then((release) => {
      if (cancelled) {
        release()
        return
      }
      releaseRef.current = release
      setCurrentSrc(src ?? null)
    })

    return () => {
      cancelled = true
      releaseRef.current?.()
      releaseRef.current = null
    }
  }, [src, attempt])

  React.useEffect(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [attempt, src])

  const handleLoad = () => {
    setLoaded(true)
    releaseSlot()
  }

  const handleError = () => {
    if (attempt < MAX_RETRIES - 1) {
      releaseSlot()
      const delay = Math.min(1000 * 2 ** attempt, 8000)
      timerRef.current = window.setTimeout(() => setAttempt((a) => a + 1), delay)
    } else {
      setFailed(true)
      releaseSlot()
    }
  }

  return (
    <div
      className={cn(
        'bg-muted relative overflow-hidden',
        fit === 'cover' && 'h-full w-full',
        containerClassName
      )}
    >
      {!loaded && !failed && (
        <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
      )}
      {failed ? (
        <div className="bg-muted text-muted-foreground absolute inset-0 flex items-center justify-center">
          <ImageOff className="size-6" />
        </div>
      ) : (
        currentSrc && (
          <img
            key={attempt}
            src={currentSrc}
            alt={alt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={handleLoad}
            onError={handleError}
            className={cn(
              'transition-opacity duration-300',
              fit === 'cover' && 'h-full w-full object-cover',
              fit === 'contain' && 'object-contain',
              loaded ? 'opacity-100' : 'opacity-0',
              className
            )}
            {...props}
          />
        )
      )}
    </div>
  )
}
