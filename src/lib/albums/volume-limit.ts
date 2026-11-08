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

export function packFiles<T extends { size: number }>(
  files: T[],
  max: number = VOLUME_MAX_BYTES
): T[][] {
  const groups: { used: number; files: T[] }[] = []
  for (const file of files) {
    const group = groups.find((g) => g.used === 0 || g.used + file.size <= max)
    if (group) {
      group.files.push(file)
      group.used += file.size
    } else {
      groups.push({ used: file.size, files: [file] })
    }
  }
  return groups.map((g) => g.files)
}

export function splitBytes(
  total: number,
  max: number = VOLUME_MAX_BYTES
): number[] {
  if (total <= 0) return [0]
  const sizes: number[] = []
  let left = total
  while (left > 0) {
    const next = Math.min(left, max)
    sizes.push(next)
    left -= next
  }
  return sizes
}
