import * as React from 'react'
import { ImageOff } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { acquireImageSlot } from '@/lib/albums/image-gate'

const MAX_RETRIES = 5

/**
 * URLs that fully loaded this session. Used to skip the placeholder for images
 * the browser already has cached (e.g. navigating back to a photo you just
 * viewed), so they never flash a skeleton/placeholder for a split second.
 */
const loadedUrls = new Set<string>()

const NEAR_VIEWPORT_MARGIN = '600px 0px'

type NearListener = (near: boolean) => void

const nearListeners = new WeakMap<Element, NearListener>()
let nearObserver: IntersectionObserver | null = null

function observeNear(element: Element, listener: NearListener): () => void {
  nearObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        nearListeners.get(entry.target)?.(entry.isIntersecting)
      }
    },
    { rootMargin: NEAR_VIEWPORT_MARGIN }
  )
  nearListeners.set(element, listener)
  nearObserver.observe(element)
  return () => {
    nearListeners.delete(element)
    nearObserver?.unobserve(element)
  }
}

/** Whether the element is within the prefetch margin of the viewport. */
function useNearViewport(ref: React.RefObject<HTMLElement | null>): boolean {
  const [near, setNear] = React.useState(false)
  React.useEffect(() => {
    const element = ref.current
    if (!element) return
    return observeNear(element, setNear)
  }, [ref])
  return near
}

interface PhotoImageProps extends React.ComponentProps<'img'> {
  containerClassName?: string
  fit?: 'cover' | 'contain'
  /**
   * Low-res stand-in shown while the main image is fetched. When provided the
   * pulsing skeleton is not rendered — pass the photo's thumbnail URL so an
   * already-cached thumbnail renders instantly and the full image crossfades
   * in on top of it.
   */
  placeholderSrc?: string
  /** Class applied to the placeholder image (e.g. to mirror the main image's inset). */
  placeholderClassName?: string
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
 * - `fit="contain"`: the image is sized by itself, centered and never cropped,
 *   `object-contain` (lightbox). The image and its placeholder overlap in the
 *   same grid cell so they stay perfectly aligned.
 */
export function PhotoImage({
  containerClassName,
  className,
  alt = '',
  src,
  fit = 'cover',
  placeholderSrc,
  placeholderClassName,
  ...props
}: PhotoImageProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const near = useNearViewport(containerRef)
  const cached = src != null && loadedUrls.has(src)
  const [attempt, setAttempt] = React.useState(0)
  const [loaded, setLoaded] = React.useState(cached)
  const [failed, setFailed] = React.useState(false)
  const [currentSrc, setCurrentSrc] = React.useState<string | null>(
    cached ? src : null
  )
  const timerRef = React.useRef<number | null>(null)
  const releaseRef = React.useRef<(() => void) | null>(null)

  const releaseSlot = React.useCallback(() => {
    releaseRef.current?.()
    releaseRef.current = null
  }, [])

  React.useEffect(() => {
    setAttempt(0)
    setFailed(false)
    // If this exact URL already finished loading this session, the browser has
    // it cached — treat it as loaded immediately so nothing flashes.
    setLoaded(src != null && loadedUrls.has(src))
  }, [src])

  // Cached URLs render straight away without a slot (back navigation shows
  // them instantly). Others wait until they are near the viewport, then for a
  // concurrency slot, held only for the fetch. Scrolling away before the
  // image loads gives the slot (or queue place) back so fast scrolling never
  // leaves slots stuck on images the user already passed. Retrying
  // (attempt++) releases the previous slot and re-queues.
  React.useEffect(() => {
    if (src != null && loadedUrls.has(src)) {
      setCurrentSrc(src)
      return
    }
    setCurrentSrc(null)
    if (src == null || !near) return

    const controller = new AbortController()
    acquireImageSlot(controller.signal).then(
      (release) => {
        if (controller.signal.aborted) {
          release()
          return
        }
        releaseRef.current = release
        setCurrentSrc(src)
      },
      () => {}
    )

    return () => {
      controller.abort()
      releaseRef.current?.()
      releaseRef.current = null
    }
  }, [src, attempt, near])

  React.useEffect(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [attempt, src])

  const handleLoad = () => {
    if (currentSrc) loadedUrls.add(currentSrc)
    setLoaded(true)
    releaseSlot()
  }

  const handleError = () => {
    if (attempt < MAX_RETRIES - 1) {
      releaseSlot()
      const delay = Math.min(1000 * 2 ** attempt, 8000)
      timerRef.current = window.setTimeout(
        () => setAttempt((a) => a + 1),
        delay
      )
    } else {
      setFailed(true)
      releaseSlot()
    }
  }

  const showPlaceholder = !loaded && !failed && placeholderSrc != null
  // With a placeholder the full image sits on top of a matching thumbnail, so
  // it can swap in instantly (looks like the photo sharpening). Without one
  // (e.g. grid tiles) fade in over the skeleton.
  const instant = placeholderSrc != null

  return (
    <div
      ref={containerRef}
      className={cn(
        'bg-muted relative grid h-full w-full place-items-center overflow-hidden',
        containerClassName
      )}
    >
      {showPlaceholder && (
        <img
          src={placeholderSrc}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={cn(
            'col-start-1 row-start-1 object-cover',
            fit === 'contain' &&
              'max-h-full max-w-full min-h-0 min-w-0 object-contain',
            placeholderClassName
          )}
        />
      )}
      {!loaded && !failed && !placeholderSrc && (
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
            loading={loadedUrls.has(currentSrc) ? 'lazy' : undefined}
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={handleLoad}
            onError={handleError}
            className={cn(
              'col-start-1 row-start-1',
              fit === 'cover' && 'h-full w-full object-cover',
              fit === 'contain' &&
                'max-h-full max-w-full min-h-0 min-w-0 object-contain',
              !instant && 'transition-opacity duration-300',
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
