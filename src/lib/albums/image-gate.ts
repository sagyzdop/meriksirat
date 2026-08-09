/**
 * Global gate that limits how many images the app fetches at once.
 *
 * Google's Drive CDN (lh3.googleusercontent.com) throttles bursts of
 * anonymous thumbnail requests, and the Worker proxy for private albums
 * counts every fetch against the master account's Drive API quota. Bounding
 * concurrency keeps both below their rate limits so photos stop graying out.
 */
const MAX_CONCURRENT = 6

type Waiter = () => void

let inFlight = 0
const waiters: Waiter[] = []

/**
 * Acquire a slot for one image fetch. Resolves to a `release` function that
 * must be called when the fetch settles (loaded, errored, or unmounted).
 */
export function acquireImageSlot(): Promise<() => void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight += 1
    return Promise.resolve(release)
  }
  return new Promise((resolve) => {
    waiters.push(() => {
      inFlight += 1
      resolve(release)
    })
  })
}

function release() {
  inFlight -= 1
  const next = waiters.shift()
  if (next) next()
}
