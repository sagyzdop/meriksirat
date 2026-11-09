/**
 * Global gate that limits how many images the app fetches at once.
 *
 * Google's Drive CDN (lh3.googleusercontent.com) throttles bursts of
 * anonymous thumbnail requests, and the Worker proxy for private albums
 * counts every fetch against the master account's Drive API quota. Bounding
 * concurrency keeps both below their rate limits so photos stop graying out.
 *
 * Only images near the viewport should hold or wait for a slot: callers pass
 * an AbortSignal and abort when the image scrolls away, which drops it from
 * the queue so slots go to what the user is looking at.
 */
const MAX_CONCURRENT = 6

type Waiter = () => void

let inFlight = 0
const waiters: Waiter[] = []

function grant(): () => void {
  inFlight += 1
  let released = false
  return () => {
    if (released) return
    released = true
    inFlight -= 1
    waiters.shift()?.()
  }
}

/**
 * Acquire a slot for one image fetch. Resolves to a `release` function that
 * must be called when the fetch settles (loaded, errored, or unmounted), and
 * rejects if `signal` aborts while still queued.
 */
export function acquireImageSlot(signal?: AbortSignal): Promise<() => void> {
  if (signal?.aborted) return Promise.reject(signal.reason)
  if (inFlight < MAX_CONCURRENT) return Promise.resolve(grant())
  return new Promise((resolve, reject) => {
    const waiter = () => {
      signal?.removeEventListener('abort', onAbort)
      resolve(grant())
    }
    const onAbort = () => {
      const index = waiters.indexOf(waiter)
      if (index !== -1) waiters.splice(index, 1)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    waiters.push(waiter)
  })
}
