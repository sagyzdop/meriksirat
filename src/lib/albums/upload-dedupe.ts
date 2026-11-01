interface PlannedJob {
  id: string
  name: string
  status: string
  albumId: string
}

export function planEnqueue(
  albumId: string,
  names: string[],
  jobs: PlannedJob[],
  existingNames: Set<string>
): { acceptNames: string[]; skipped: string[]; replaceJobIds: string[] } {
  const albumJobs = jobs.filter((job) => job.albumId === albumId)
  const blocked = new Set(
    albumJobs
      .filter((job) => job.status === 'queued' || job.status === 'uploading')
      .map((job) => job.name)
  )
  const failedByName = new Map<string, string[]>()
  for (const job of albumJobs) {
    if (job.status !== 'error') continue
    failedByName.set(job.name, [...(failedByName.get(job.name) ?? []), job.id])
  }

  const acceptNames: string[] = []
  const skipped: string[] = []
  const replaceJobIds: string[] = []
  const seen = new Set<string>()
  for (const name of names) {
    if (existingNames.has(name) || blocked.has(name) || seen.has(name)) {
      skipped.push(name)
      continue
    }
    seen.add(name)
    acceptNames.push(name)
    replaceJobIds.push(...(failedByName.get(name) ?? []))
  }
  return { acceptNames, skipped, replaceJobIds }
}
