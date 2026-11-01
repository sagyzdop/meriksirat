export const DRIVE_BATCH_LIMIT = 100

export function buildBatchDeleteBody(
  fileIds: string[],
  boundary: string
): string {
  const lines: string[] = []
  fileIds.forEach((id, index) => {
    lines.push(
      `--${boundary}`,
      'Content-Type: application/http',
      `Content-ID: <${index}>`,
      '',
      `DELETE /drive/v3/files/${encodeURIComponent(id)}`,
      ''
    )
  })
  lines.push(`--${boundary}--`, '')
  return lines.join('\r\n')
}

export function parseBatchStatuses(
  body: string,
  fileIds: string[]
): Map<string, number> {
  const statuses = new Map<string, number>()
  const pattern =
    /Content-ID:\s*<?response-(\d+)>?[\s\S]*?HTTP\/\d(?:\.\d)?\s+(\d{3})/gi
  for (const match of body.matchAll(pattern)) {
    const id = fileIds[Number(match[1])]
    if (id !== undefined) statuses.set(id, Number(match[2]))
  }
  return statuses
}
