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

export interface BatchPartResult {
  status: number
  body: string
}

export function parseBatchResults(
  body: string,
  fileIds: string[]
): Map<string, BatchPartResult> {
  const results = new Map<string, BatchPartResult>()
  const segments = body.split(/Content-ID:\s*<?response-(\d+)>?/i)
  for (let i = 1; i + 1 < segments.length; i += 2) {
    const id = fileIds[Number(segments[i])]
    const text = segments[i + 1]
    const match = text.match(/HTTP\/\d(?:\.\d)?\s+(\d{3})/i)
    if (id !== undefined && match) {
      results.set(id, { status: Number(match[1]), body: text })
    }
  }
  return results
}

export function hasBatchAuthFailure(
  results: Iterable<BatchPartResult>
): boolean {
  for (const result of results) {
    if (result.status === 401) return true
  }
  return false
}
