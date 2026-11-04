interface PlannedJob {
  id: string
  name: string
  size: number
  status: string
  albumId: string
}

export const NEEDS_HASH_MESSAGE = 'Duplicate check needs the file hash'

const fileKey = (name: string, size: number) => `${size}:${name}`

export function planEnqueue(
  albumId: string,
  files: { name: string; size: number }[],
  jobs: PlannedJob[]
): { acceptNames: string[]; skipped: string[]; replaceJobIds: string[] } {
  const albumJobs = jobs.filter((job) => job.albumId === albumId)
  const blocked = new Set(
    albumJobs
      .filter((job) => job.status === 'queued' || job.status === 'uploading')
      .map((job) => fileKey(job.name, job.size))
  )
  const failedByFile = new Map<string, string[]>()
  for (const job of albumJobs) {
    if (job.status !== 'error') continue
    const key = fileKey(job.name, job.size)
    failedByFile.set(key, [...(failedByFile.get(key) ?? []), job.id])
  }

  const acceptNames: string[] = []
  const skipped: string[] = []
  const replaceJobIds: string[] = []
  const seen = new Set<string>()
  for (const file of files) {
    const key = fileKey(file.name, file.size)
    if (blocked.has(key) || seen.has(key)) {
      skipped.push(file.name)
      continue
    }
    seen.add(key)
    acceptNames.push(file.name)
    replaceJobIds.push(...(failedByFile.get(key) ?? []))
  }
  return { acceptNames, skipped, replaceJobIds }
}

interface ListedFile {
  size?: string | number | null
  md5Checksum?: string | null
}

export type DuplicateCheck =
  { kind: 'unique' } | { kind: 'needs-hash' } | { kind: 'duplicate' }

export function planDuplicateCheck(
  size: number,
  md5: string | undefined,
  listed: ListedFile[]
): DuplicateCheck {
  const sameSize = listed.filter((file) => Number(file.size ?? 0) === size)
  if (sameSize.length === 0) return { kind: 'unique' }
  if (!md5) return { kind: 'needs-hash' }
  const wanted = md5.toLowerCase()
  const match = sameSize.some(
    (file) => file.md5Checksum?.toLowerCase() === wanted
  )
  return { kind: match ? 'duplicate' : 'unique' }
}
