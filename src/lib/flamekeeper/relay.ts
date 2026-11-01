import { confirmRelayFn, releaseRelayFn, startRelayFn } from './functions'
import type { DrainStatus } from './types'

export type RelayStep =
  | { kind: 'moved'; name: string; bytes: number; status: DrainStatus }
  | { kind: 'done'; status: DrainStatus }
  | { kind: 'no_space'; message: string }

class RelayQuotaError extends Error {}

/**
 * Move one photo of a draining flamekeeper (ADR-0009): download it with the
 * source token, upload it into the destination's resumable session in the
 * same album folder, then confirm so the server swaps the Drive file ID and
 * deletes the old file. The bytes stay in this browser.
 */
export async function relayOnePhoto(
  userId?: string,
  signal?: AbortSignal
): Promise<RelayStep> {
  const handout = await startRelayFn({ data: { userId } })
  if (handout.kind !== 'photo') return handout

  let fileId: string
  try {
    const download = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(handout.sourceFileId)}?alt=media`,
      { headers: { Authorization: `Bearer ${handout.sourceToken}` }, signal }
    )
    if (!download.ok) {
      throw new Error(
        `Could not download "${handout.name}" (${download.status})`
      )
    }
    const bytes = await download.blob()

    const upload = await fetch(handout.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: bytes,
      signal,
    })
    if (!upload.ok) {
      const text = await upload.text()
      if (upload.status === 403 && text.includes('storageQuotaExceeded')) {
        throw new RelayQuotaError('Destination Drive is full')
      }
      throw new Error(`Could not upload "${handout.name}" (${upload.status})`)
    }
    const body = (await upload.json()) as { id?: string }
    if (!body.id) throw new Error('Google did not return the moved file')
    fileId = body.id
  } catch (error) {
    void releaseRelayFn({
      data: {
        userId,
        albumId: handout.albumId,
        reservationId: handout.reservationId,
        quotaExceeded: error instanceof RelayQuotaError,
      },
    }).catch(() => {})
    throw error
  }

  const status = await confirmRelayFn({
    data: {
      userId,
      photoId: handout.photoId,
      reservationId: handout.reservationId,
      fileId,
    },
  })
  return { kind: 'moved', name: handout.name, bytes: handout.bytes, status }
}
