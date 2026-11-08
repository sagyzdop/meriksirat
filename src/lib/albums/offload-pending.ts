import type { OffloadPending } from './storage-plan'

const PENDING_TTL_SECONDS = 6 * 60 * 60

const pendingKey = (albumId: string) => `album:offload:${albumId}`

async function kv(): Promise<KVNamespace> {
  const { env } = await import('cloudflare:workers')
  return env.meriksirat_kv as KVNamespace
}

export async function readOffloadPending(
  albumId: string
): Promise<OffloadPending | null> {
  const raw = await (await kv()).get(pendingKey(albumId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as OffloadPending
    return Array.isArray(parsed.volumes) &&
      Array.isArray(parsed.sourceFolders) &&
      Array.isArray(parsed.checkedFolders)
      ? parsed
      : null
  } catch {
    return null
  }
}

export async function writeOffloadPending(
  albumId: string,
  pending: OffloadPending
): Promise<void> {
  await (
    await kv()
  ).put(pendingKey(albumId), JSON.stringify(pending), {
    expirationTtl: PENDING_TTL_SECONDS,
  })
}

export async function clearOffloadPending(albumId: string): Promise<void> {
  try {
    await (await kv()).delete(pendingKey(albumId))
  } catch (error) {
    console.warn('Could not clear offload state:', error)
  }
}

const RESCUE_TTL_SECONDS = 24 * 60 * 60

const rescueKey = (albumId: string) => `album:rescue:${albumId}`

export async function markRescueStarted(albumId: string): Promise<void> {
  const store = await kv()
  await store.put(rescueKey(albumId), String(Date.now()), {
    expirationTtl: RESCUE_TTL_SECONDS,
  })
}

export async function clearRescueMarker(albumId: string): Promise<void> {
  try {
    await (await kv()).delete(rescueKey(albumId))
  } catch (error) {
    console.warn('Could not clear rescue marker:', error)
  }
}

export async function albumMoveInProgress(albumId: string): Promise<boolean> {
  try {
    const store = await kv()
    const [offload, rescue] = await Promise.all([
      store.get(pendingKey(albumId)),
      store.get(rescueKey(albumId)),
    ])
    return !!offload || !!rescue
  } catch (error) {
    console.warn('Could not read album move state:', error)
    return true
  }
}

export async function hasOffloadPending(
  albumId: string,
  onError = true
): Promise<boolean> {
  try {
    return !!(await (await kv()).get(pendingKey(albumId)))
  } catch (error) {
    console.warn('Could not read offload state:', error)
    return onError
  }
}
