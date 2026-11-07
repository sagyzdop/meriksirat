import SparkMD5 from 'spark-md5'

export interface OffloadSessionFile {
  id: string
  name: string
  size: number
  md5: string
  uploaded?: boolean
}

export interface OffloadSession {
  albumId: string
  files: OffloadSessionFile[]
  downloadToken: string
  uploadUrl: string
  volumeFolderId: string
}

export interface OffloadOptions {
  onProgress(
    albumId: string,
    fileIndex: number,
    fileCount: number,
    bytesDone: number,
    bytesTotal: number
  ): void
  signal?: AbortSignal
  mintUploadUrls?(
    albumId: string,
    fileIds: string[]
  ): Promise<Record<string, string>>
}

const CHUNK_BYTES = 8 * 1024 * 1024
const MAX_ATTEMPTS = 5
const MINT_GROUP = 20
const DOWNLOAD = 'https://www.googleapis.com/drive/v3/files'

class TransientError extends Error {}

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
  file: OffloadSessionFile,
  token: string,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  return retrying(async () => {
    const response = await fetch(
      `${DOWNLOAD}/${encodeURIComponent(file.id)}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` }, signal }
    )
    if (!response.ok) {
      if (isTransient(response.status)) {
        throw new TransientError(`Download failed (${response.status})`)
      }
      throw new Error(`Could not read ${file.name} (${response.status})`)
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
  file: OffloadSessionFile,
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
    if (!response.ok) throw new Error(`Could not upload ${file.name}`)
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
      throw new Error(`Could not upload ${file.name} (${response.status})`)
    }, signal)
    if (result === 'done') {
      onBytes(size)
      return
    }
    offset = result
    onBytes(offset)
  }
}

export async function runOffloadSession(
  session: OffloadSession,
  options: OffloadOptions
): Promise<void> {
  const { files, albumId } = session
  const { signal } = options
  const bytesTotal = files.reduce((n, f) => n + f.size, 0)
  const urls = new Map<string, string>()
  if (files[0] && !files[0].uploaded) urls.set(files[0].id, session.uploadUrl)
  let bytesDone = 0

  for (let index = 0; index < files.length; index++) {
    throwIfAborted(signal)
    const file = files[index]
    if (file.uploaded) {
      bytesDone += file.size
      options.onProgress(albumId, index, files.length, bytesDone, bytesTotal)
      continue
    }
    if (!urls.has(file.id)) {
      if (!options.mintUploadUrls) {
        throw new Error('No way to start uploads for the remaining files')
      }
      const group = files
        .slice(index, index + MINT_GROUP)
        .map((f) => f.id)
        .filter((id) => !urls.has(id))
      const minted = await options.mintUploadUrls(albumId, group)
      for (const [id, url] of Object.entries(minted)) urls.set(id, url)
    }
    const uploadUrl = urls.get(file.id)
    if (!uploadUrl) throw new Error(`No upload address for ${file.name}`)

    const data = await download(file, session.downloadToken, signal)
    const before = bytesDone
    await upload(
      file,
      data,
      uploadUrl,
      (done) =>
        options.onProgress(
          albumId,
          index,
          files.length,
          before + done,
          bytesTotal
        ),
      signal
    )
    bytesDone = before + file.size
    options.onProgress(albumId, index, files.length, bytesDone, bytesTotal)
  }
}
