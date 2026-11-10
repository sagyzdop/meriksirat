import SparkMD5 from 'spark-md5'
import type { FileIdentity, OffloadMint } from './storage-plan'
import { UserError } from '@/lib/user-error'

export interface OffloadRun {
  albumId: string
  files: FileIdentity[]
  downloadToken: string
}

export interface OffloadOptions {
  signal?: AbortSignal
  mint(albumId: string, fileIds: string[]): Promise<OffloadMint>
  refreshDownloadToken(albumId: string): Promise<string>
  onFile(albumId: string, index: number, state: 'copying' | 'done'): void
  onBytes(albumId: string, bytesDone: number, bytesTotal: number): void
}

const CHUNK_BYTES = 8 * 1024 * 1024
const MAX_ATTEMPTS = 5
const MINT_GROUP = 20
const DOWNLOAD = 'https://www.googleapis.com/drive/v3/files'

class TransientError extends UserError {}

class ExpiredTokenError extends Error {}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Offload aborted', 'AbortError')
}

function isTransient(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Offload aborted', 'AbortError'))
      },
      { once: true }
    )
  })
}

async function retrying<T>(
  run: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  let attempt = 0
  while (true) {
    throwIfAborted(signal)
    try {
      return await run()
    } catch (error) {
      attempt++
      const retryable =
        error instanceof TransientError || error instanceof TypeError
      if (!retryable || attempt >= MAX_ATTEMPTS) throw error
      await wait(500 * 2 ** attempt, signal)
    }
  }
}

async function download(
  file: FileIdentity,
  token: string,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  return retrying(async () => {
    const response = await fetch(
      `${DOWNLOAD}/${encodeURIComponent(file.id)}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` }, signal }
    )
    if (response.status === 401) throw new ExpiredTokenError()
    if (!response.ok) {
      if (isTransient(response.status)) {
        throw new TransientError(`Download failed (${response.status})`)
      }
      throw new UserError(`Could not read ${file.name} (${response.status})`)
    }
    const buffer = await response.arrayBuffer()
    if (file.md5 && SparkMD5.ArrayBuffer.hash(buffer) !== file.md5) {
      throw new TransientError(`${file.name} changed during download`)
    }
    return buffer
  }, signal)
}

async function uploadedOffset(
  uploadUrl: string,
  size: number,
  signal?: AbortSignal
): Promise<number | 'done'> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Range': `bytes */${size}` },
    signal,
  })
  if (response.status === 200 || response.status === 201) return 'done'
  if (response.status !== 308) {
    throw new TransientError(`Upload status failed (${response.status})`)
  }
  const range = response.headers.get('Range')
  const match = range?.match(/bytes=0-(\d+)/)
  return match ? Number(match[1]) + 1 : 0
}

async function upload(
  file: FileIdentity,
  data: ArrayBuffer,
  uploadUrl: string,
  onBytes: (done: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const size = data.byteLength
  if (size === 0) {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: new Blob([]),
      signal,
    })
    if (!response.ok) throw new UserError(`Could not upload ${file.name}`)
    return
  }
  let offset = 0
  while (offset < size) {
    const end = Math.min(offset + CHUNK_BYTES, size)
    const result = await retrying(async () => {
      let response: Response
      try {
        response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'text/plain',
            'Content-Range': `bytes ${offset}-${end - 1}/${size}`,
          },
          body: new Blob([data.slice(offset, end)]),
          signal,
        })
      } catch (error) {
        if (signal?.aborted) throw error
        const resume = await uploadedOffset(uploadUrl, size, signal)
        return resume
      }
      if (response.status === 200 || response.status === 201) return 'done'
      if (response.status === 308) {
        const match = response.headers.get('Range')?.match(/bytes=0-(\d+)/)
        return match ? Number(match[1]) + 1 : 0
      }
      if (isTransient(response.status)) {
        throw new TransientError(`Upload failed (${response.status})`)
      }
      throw new UserError(`Could not upload ${file.name} (${response.status})`)
    }, signal)
    if (result === 'done') {
      onBytes(size)
      return
    }
    offset = result
    onBytes(offset)
  }
}

export async function runOffload(
  run: OffloadRun,
  options: OffloadOptions
): Promise<void> {
  const { files, albumId } = run
  const { signal } = options
  const bytesTotal = files.reduce((n, f) => n + f.size, 0)
  const urls = new Map<string, string>()
  const uploaded = new Set<string>()
  let token = run.downloadToken
  let bytesDone = 0

  const resolve = async (ids: string[]) => {
    const minted = await options.mint(albumId, ids)
    for (const [id, url] of Object.entries(minted.urls)) urls.set(id, url)
    for (const id of minted.uploaded) uploaded.add(id)
    if (minted.downloadToken) token = minted.downloadToken
  }
  const known = (id: string) => urls.has(id) || uploaded.has(id)

  for (let index = 0; index < files.length; index++) {
    throwIfAborted(signal)
    const file = files[index]
    if (!known(file.id)) {
      await resolve(
        files
          .slice(index, index + MINT_GROUP)
          .map((f) => f.id)
          .filter((id) => !known(id))
      )
      if (!known(file.id)) await resolve([file.id])
    }
    if (uploaded.has(file.id)) {
      bytesDone += file.size
      options.onFile(albumId, index, 'done')
      options.onBytes(albumId, bytesDone, bytesTotal)
      continue
    }
    const uploadUrl = urls.get(file.id)
    if (!uploadUrl) throw new UserError(`No upload address for ${file.name}`)

    options.onFile(albumId, index, 'copying')
    let data: ArrayBuffer
    try {
      data = await download(file, token, signal)
    } catch (error) {
      if (!(error instanceof ExpiredTokenError)) throw error
      token = await options.refreshDownloadToken(albumId)
      try {
        data = await download(file, token, signal)
      } catch (again) {
        if (again instanceof ExpiredTokenError) {
          throw new UserError(
            'The buffer refused the download; try again later'
          )
        }
        throw again
      }
    }
    const before = bytesDone
    await upload(
      file,
      data,
      uploadUrl,
      (done) => options.onBytes(albumId, before + done, bytesTotal),
      signal
    )
    bytesDone = before + file.size
    uploaded.add(file.id)
    options.onFile(albumId, index, 'done')
    options.onBytes(albumId, bytesDone, bytesTotal)
  }
}
