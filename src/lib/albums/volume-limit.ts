export const VOLUME_MAX_BYTES = 256 * 1024 * 1024

export function pickVolumeWithRoom<T extends { expectedBytes: number | null }>(
  volumes: T[],
  incomingBytes: number
): T | null {
  return (
    volumes.find((v) => {
      const used = v.expectedBytes ?? 0
      return used === 0 || used + incomingBytes <= VOLUME_MAX_BYTES
    }) ?? null
  )
}
