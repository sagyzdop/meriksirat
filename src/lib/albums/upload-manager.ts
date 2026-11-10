import { useSyncExternalStore } from 'react'
import { confirmPhotoUploadsFn, createUploadSessionsFn } from './functions'
import { BUFFER_FULL_MESSAGE } from '@/lib/buffer/messages'
import { toast } from 'sonner'
import { planEnqueue } from './upload-dedupe'
import { md5OfFile } from './file-md5'
import { UPLOAD_BATCH_MAX } from './types'
import {
  deleteUploadFiles,
  getUploadFiles,
  loadJobs,
  saveJobs,
  saveUploadFiles,
} from './upload-storage'
import { UserError, isUserError, userMessage } from '@/lib/user-error'

export type UploadStatus =
  'queued' | 'uploading' | 'done' | 'duplicate' | 'error' | 'cancelled'

export interface UploadJob {
  id: string
  albumId: string
  albumTitle: string
  name: string
  size: number
  mimeType: string
  status: UploadStatus
  progress: number
  error?: string
  /**
   * Number of upload attempts already made. Persisted so the auto-retry budget
   * survives page reloads.
   */
  attempts?: number
  /**
   * Earliest timestamp (ms) at which a backed-off queued job may run again.
   */
  nextAttemptAt?: number
  /**
   * When a job reached a terminal state (done/error/cancelled). Finished jobs
   * auto-expire after their TTL so they don't accumulate in the header widget
   * and localStorage forever.
   */
  finishedAt?: number
}

/**
 * Finished jobs are kept briefly so the UI can show the completed state and so
 * errors stay retryable for a while, but they auto-expire after these TTLs.
 */
const FINISHED_TTL_MS: Record<
  'done' | 'duplicate' | 'error' | 'cancelled',
  number
> = {
  done: 60 * 60 * 1000, // 1 hour
  duplicate: 60 * 60 * 1000, // 1 hour
  cancelled: 60 * 60 * 1000, // 1 hour
  error: 7 * 24 * 60 * 60 * 1000, // 7 days — long enough to retry manually
}

/**
 * Failure worth retrying automatically: browser-level network failures (the
 * fetch to mint an upload session rejects with `TypeError: Load failed`) and
 * the transient XHR PUT errors below (network error, timeout, 5xx, 429).
 */
class TransientUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TransientUploadError'
  }
}

class QuotaExceededUploadError extends UserError {
  constructor() {
    super(BUFFER_FULL_MESSAGE)
  }
}

function isTransientError(error: unknown): boolean {
  return error instanceof TransientUploadError || error instanceof TypeError
}

function retryDelay(attempt: number): number {
  const base = Math.min(1000 * 2 ** (attempt - 1), 30000)
  return Math.round(base * (0.8 + Math.random() * 0.4))
}

/**
 * How long an uploaded file may wait for others to share its confirm request.
 * A file still waiting when the page reloads is uploaded again, so keep short.
 */
const CONFIRM_WAIT_MS = 4000

interface PendingConfirm {
  job: UploadJob
  fileId: string
  attempt: number
  since: number
}

/**
 * Global upload manager (module singleton).
 *
 * State lives outside React so uploads keep running when the user navigates
 * away from the album page. Components subscribe via `useUploads()`.
 * Each file is uploaded directly to Google Drive (mint a resumable session on
 * the server, then PUT the bytes in the browser via XHR for progress events).
 * Sessions are minted and uploads confirmed in batches of up to
 * UPLOAD_BATCH_MAX files, so each photo costs the Worker a fraction of a
 * request instead of two or three.
 *
 * Jobs and their `File` payloads are persisted (localStorage + IndexedDB), so
 * a page refresh restores in-flight uploads and resumes them instead of
 * silently cancelling them.
 */
class UploadManager {
  private snapshot: UploadJob[] = []
  private listeners = new Set<() => void>()
  private filesById = new Map<string, File>()
  private xhrsById = new Map<string, XMLHttpRequest>()
  private sessionsById = new Map<string, string>()
  private md5ById = new Map<string, string>()
  private hashing = new Set<string>()
  private opening = false
  private confirms: PendingConfirm[] = []
  private confirming = false
  private confirmTimer: ReturnType<typeof setTimeout> | null = null
  private running = 0
  private readonly maxConcurrent = 2
  private readonly maxAttempts = 5
  private serverFailures = 0
  private readonly maxServerFailures = 3
  private rehydrated = false

  constructor() {
    this.snapshot = loadJobs().map((job) => ({
      ...job,
      // Uploads interrupted by a refresh restart from scratch.
      status:
        job.status === 'uploading' ? 'queued' : (job.status as UploadStatus),
      progress: job.status === 'uploading' ? 0 : job.progress,
      attempts: job.attempts ?? 0,
    }))
    this.purgeExpired()
    this.persist()
    void this.rehydrate()
    if (typeof window !== 'undefined') {
      // Sweep finished jobs that have hit their TTL since the last sweep.
      setInterval(() => this.purgeExpired(), 60 * 1000)
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): UploadJob[] => this.snapshot

  private emit(next: UploadJob[]): void {
    this.snapshot = next
    this.listeners.forEach((l) => l())
  }

  private persist(): void {
    saveJobs(this.snapshot)
  }

  private patch(id: string, changes: Partial<UploadJob>): void {
    const next = this.snapshot.map((job) =>
      job.id === id ? { ...job, ...changes } : job
    )
    this.emit(next)
    this.persist()
  }

  /**
   * Restore persisted files after a refresh and resume queued uploads. Jobs
   * whose `File` could not be recovered are failed so the user can re-pick.
   */
  private async rehydrate(): Promise<void> {
    if (this.rehydrated) return
    this.rehydrated = true
    const queued = this.snapshot.filter((job) => job.status === 'queued')
    if (queued.length === 0) return
    const files = await getUploadFiles(queued.map((job) => job.id))
    const missing: string[] = []
    for (const job of queued) {
      const file = files.get(job.id)
      if (file) {
        this.filesById.set(job.id, file)
      } else {
        missing.push(job.id)
      }
    }
    if (missing.length > 0) {
      const next = this.snapshot.map((job) =>
        missing.includes(job.id)
          ? {
              ...job,
              status: 'error' as const,
              error: 'File is no longer available — choose it again',
            }
          : job
      )
      this.emit(next)
      this.persist()
    }
    // Let the freshly loaded page settle before restarting uploads: jobs
    // firing at the exact moment of a reload pile onto the same Worker cold
    // start as the HTML/asset requests, which makes the first attempt fail
    // with network errors. A short stagger avoids that burst; auto-retry
    // catches anything that still slips through.
    await new Promise((resolve) => setTimeout(resolve, 400))
    this.pump()
  }

  /**
   * Queue files for upload. Files already queued or uploading in the same
   * album, or repeated in the same batch (same name and size), are skipped.
   * Duplicates of photos already in the album are caught by size and MD5 when
   * the upload session is requested. Returns the accepted jobs and the
   * skipped names.
   */
  enqueue(
    albumId: string,
    albumTitle: string,
    files: File[]
  ): { accepted: UploadJob[]; skipped: string[] } {
    const accepted: UploadJob[] = []
    const plan = planEnqueue(
      albumId,
      files.map((file) => ({ name: file.name, size: file.size })),
      this.snapshot
    )
    const skipped = plan.skipped
    const acceptable = new Set(plan.acceptNames)

    for (const file of files) {
      if (!acceptable.has(file.name)) continue
      acceptable.delete(file.name)
      const job: UploadJob = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        albumId,
        albumTitle,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'image/jpeg',
        status: 'queued',
        progress: 0,
        attempts: 0,
      }
      this.filesById.set(job.id, file)
      accepted.push(job)
    }

    if (accepted.length === 0) {
      return { accepted, skipped }
    }

    const replaced = new Set(plan.replaceJobIds)
    replaced.forEach((id) => this.filesById.delete(id))
    if (replaced.size > 0) void deleteUploadFiles([...replaced])

    this.emit([
      ...this.snapshot.filter((job) => !replaced.has(job.id)),
      ...accepted,
    ])
    this.persist()
    void saveUploadFiles(
      accepted.flatMap((job) => {
        const file = this.filesById.get(job.id)
        return file ? [{ id: job.id, file }] : []
      })
    )
    this.pump()
    return { accepted, skipped }
  }

  cancel(id: string): void {
    this.xhrsById.get(id)?.abort()
    this.filesById.delete(id)
    this.sessionsById.delete(id)
    this.md5ById.delete(id)
    this.patch(id, { status: 'cancelled', finishedAt: Date.now() })
    void deleteUploadFiles([id])
    this.pump()
  }

  async retry(id: string): Promise<void> {
    const job = this.snapshot.find((j) => j.id === id)
    if (!job) return

    let file = this.filesById.get(id)
    if (!file) {
      const files = await getUploadFiles([id])
      file = files.get(id)
      if (file) this.filesById.set(id, file)
    }
    if (!file) {
      this.patch(id, {
        status: 'error',
        error: 'File is no longer available — choose it again',
      })
      return
    }
    this.patch(id, {
      status: 'queued',
      progress: 0,
      error: undefined,
      attempts: 0,
      nextAttemptAt: undefined,
    })
    this.serverFailures = 0
    this.pump()
  }

  clear(albumId?: string): void {
    const next = this.snapshot.filter(
      (job) =>
        !['done', 'duplicate', 'error', 'cancelled'].includes(job.status) ||
        (albumId !== undefined && job.albumId !== albumId)
    )
    const removedIds = this.snapshot
      .filter((job) => !next.some((kept) => kept.id === job.id))
      .map((job) => job.id)
    removedIds.forEach((id) => this.filesById.delete(id))
    this.emit(next)
    this.persist()
    if (removedIds.length > 0) void deleteUploadFiles(removedIds)
  }

  /**
   * Drop finished jobs that have been done/cancelled/errored for longer than
   * their TTL. Active jobs are never touched.
   */
  private purgeExpired(): void {
    const now = Date.now()
    const expired = this.snapshot.filter((job) => {
      if (!job.finishedAt) return false
      const ttl = FINISHED_TTL_MS[job.status as keyof typeof FINISHED_TTL_MS]
      if (ttl === undefined) return false
      return now - job.finishedAt >= ttl
    })
    if (expired.length === 0) return
    const expiredIds = new Set(expired.map((j) => j.id))
    const next = this.snapshot.filter((j) => !expiredIds.has(j.id))
    expiredIds.forEach((id) => this.filesById.delete(id))
    this.emit(next)
    this.persist()
    void deleteUploadFiles([...expiredIds])
  }

  private isActive(id: string): boolean {
    const status = this.snapshot.find((job) => job.id === id)?.status
    return status === 'queued' || status === 'uploading'
  }

  private pump(): void {
    const now = Date.now()
    const ready = (job: UploadJob) =>
      job.status === 'queued' &&
      (job.nextAttemptAt === undefined || job.nextAttemptAt <= now) &&
      !this.hashing.has(job.id)

    while (this.running < this.maxConcurrent) {
      const next = this.snapshot.find(
        (job) => ready(job) && this.sessionsById.has(job.id)
      )
      if (!next) break
      this.running++
      void this.run(next)
    }

    // Mint the next batch of sessions while the current uploads run, so a
    // free slot never waits on the Worker.
    const withSession = this.snapshot.filter(
      (job) => ready(job) && this.sessionsById.has(job.id)
    ).length
    if (!this.opening && withSession < this.maxConcurrent) {
      const first = this.snapshot.find(
        (job) => ready(job) && !this.sessionsById.has(job.id)
      )
      if (first) {
        void this.openSessions(
          this.snapshot
            .filter(
              (job) =>
                job.albumId === first.albumId &&
                ready(job) &&
                !this.sessionsById.has(job.id)
            )
            .slice(0, UPLOAD_BATCH_MAX)
        )
      }
    }

    this.flushConfirms()
  }

  private async openSessions(batch: UploadJob[]): Promise<void> {
    this.opening = true
    try {
      const results = await createUploadSessionsFn({
        data: {
          albumId: batch[0].albumId,
          files: batch.map((job) => ({
            fileName: job.name,
            mimeType: job.mimeType,
            size: job.size,
            md5: this.md5ById.get(job.id),
          })),
        },
      })
      this.serverFailures = 0
      const toHash: UploadJob[] = []
      batch.forEach((job, i) => {
        if (!this.isActive(job.id)) return
        const result = results[i]
        const attempt = (job.attempts ?? 0) + 1
        switch (result.kind) {
          case 'session':
            this.sessionsById.set(job.id, result.uploadUrl)
            break
          case 'needs-hash':
            toHash.push(job)
            break
          case 'duplicate':
            this.markDuplicate(job, attempt)
            break
          case 'failed':
            this.fail(job, new UserError(result.message), attempt)
            break
        }
      })
      if (toHash.length > 0) void this.hashFiles(toHash)
    } catch (error) {
      this.serverCallFailed(error, [])
      for (const job of batch) {
        if (this.isActive(job.id)) {
          this.fail(job, error, (job.attempts ?? 0) + 1)
        }
      }
    } finally {
      this.opening = false
      this.pump()
    }
  }

  private async hashFiles(jobs: UploadJob[]): Promise<void> {
    jobs.forEach((job) => this.hashing.add(job.id))
    for (const job of jobs) {
      try {
        const file = this.filesById.get(job.id)
        if (!file) throw new UserError('Upload file is missing')
        this.md5ById.set(job.id, await md5OfFile(file))
      } catch (error) {
        this.fail(job, error, (job.attempts ?? 0) + 1)
      } finally {
        this.hashing.delete(job.id)
      }
    }
    this.pump()
  }

  private async run(job: UploadJob): Promise<void> {
    const attempt = (job.attempts ?? 0) + 1
    const uploadUrl = this.sessionsById.get(job.id)!
    this.sessionsById.delete(job.id)
    this.patch(job.id, { status: 'uploading', progress: 0 })
    try {
      const fileId = await this.putFile(job.id, uploadUrl)
      if (fileId) {
        this.confirms.push({ job, fileId, attempt, since: Date.now() })
      } else {
        this.finish(job, attempt)
      }
    } catch (error) {
      this.fail(job, error, attempt)
    } finally {
      this.running--
      this.pump()
    }
  }

  /**
   * Send the uploaded files of one album for confirmation once a batch is
   * full, nothing else is uploading, or the oldest has waited CONFIRM_WAIT_MS.
   */
  private flushConfirms(): void {
    if (this.confirming || this.confirms.length === 0) return
    const albumId = this.confirms[0].job.albumId
    const batch = this.confirms
      .filter((item) => item.job.albumId === albumId)
      .slice(0, UPLOAD_BATCH_MAX)
    const waited = Date.now() - this.confirms[0].since
    if (
      batch.length < UPLOAD_BATCH_MAX &&
      this.running > 0 &&
      waited < CONFIRM_WAIT_MS
    ) {
      this.confirmTimer ??= setTimeout(() => {
        this.confirmTimer = null
        this.flushConfirms()
      }, CONFIRM_WAIT_MS - waited)
      return
    }
    if (this.confirmTimer) {
      clearTimeout(this.confirmTimer)
      this.confirmTimer = null
    }
    this.confirms = this.confirms.filter((item) => !batch.includes(item))
    void this.sendConfirms(albumId, batch)
  }

  private async sendConfirms(
    albumId: string,
    batch: PendingConfirm[]
  ): Promise<void> {
    this.confirming = true
    try {
      const results = await this.confirmUploads(
        albumId,
        batch.map((item) => item.fileId)
      )
      this.serverFailures = 0
      batch.forEach((item, i) => {
        const result = results[i]
        if (result.kind === 'confirmed') {
          this.finish(item.job, item.attempt)
        } else {
          this.fail(item.job, new UserError(result.message), item.attempt)
        }
      })
    } catch (error) {
      if (!this.serverCallFailed(error, batch)) {
        for (const item of batch) this.fail(item.job, error, item.attempt)
      }
    } finally {
      this.confirming = false
      this.pump()
    }
  }

  /**
   * Count a server call that failed with anything but a UserError. After a few
   * in a row (most often this tab still runs a build the Worker no longer
   * has), stop every waiting upload instead of retrying each one against the
   * Worker. Returns whether the queue was stopped.
   */
  private serverCallFailed(error: unknown, batch: PendingConfirm[]): boolean {
    if (isUserError(error)) return false
    this.serverFailures++
    if (this.serverFailures < this.maxServerFailures) return false
    const stopped = {
      status: 'error' as const,
      finishedAt: Date.now(),
      error:
        'Uploads stopped after repeated server errors. Reload the page, then retry.',
    }
    for (const item of [...batch, ...this.confirms]) {
      this.patch(item.job.id, { ...stopped, attempts: item.attempt })
    }
    this.confirms = []
    for (const job of this.snapshot) {
      if (job.status !== 'queued') continue
      this.sessionsById.delete(job.id)
      this.patch(job.id, stopped)
    }
    return true
  }

  private async confirmUploads(albumId: string, fileIds: string[]) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await confirmPhotoUploadsFn({ data: { albumId, fileIds } })
      } catch (error) {
        if (isUserError(error)) throw error
        if (attempt >= 3) throw new TransientUploadError(String(error))
        await new Promise((r) => setTimeout(r, 500 * attempt))
      }
    }
  }

  private finish(job: UploadJob, attempt: number): void {
    this.filesById.delete(job.id)
    this.md5ById.delete(job.id)
    void deleteUploadFiles([job.id])
    if (!this.isActive(job.id)) return
    this.patch(job.id, {
      status: 'done',
      progress: 100,
      attempts: attempt,
      finishedAt: Date.now(),
    })
  }

  private markDuplicate(job: UploadJob, attempt: number): void {
    // The server refused to start the upload, so nothing was sent.
    this.patch(job.id, {
      status: 'duplicate',
      progress: 0,
      attempts: attempt,
      error: undefined,
      finishedAt: Date.now(),
    })
    this.filesById.delete(job.id)
    this.md5ById.delete(job.id)
    void deleteUploadFiles([job.id])
    toast.warning(`"${job.name}" is already in this album, skipped`)
  }

  private fail(job: UploadJob, error: unknown, attempt: number): void {
    this.sessionsById.delete(job.id)
    if (!this.isActive(job.id)) return
    if (isTransientError(error) && attempt < this.maxAttempts) {
      // Transient failure (network error, timeout, 5xx, 429): back off
      // and re-queue automatically. `nextAttemptAt` is persisted so a
      // page refresh doesn't shortcut the wait.
      const delay = retryDelay(attempt)
      this.patch(job.id, {
        status: 'queued',
        attempts: attempt,
        nextAttemptAt: Date.now() + delay,
        error: undefined,
      })
      setTimeout(() => this.pump(), delay)
    } else {
      this.patch(job.id, {
        status: 'error',
        attempts: attempt,
        finishedAt: Date.now(),
        error: isTransientError(error)
          ? `Upload failed after ${attempt} attempts — retry manually`
          : userMessage(error, 'Upload failed'),
      })
    }
  }

  private putFile(jobId: string, uploadUrl: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const file = this.filesById.get(jobId)
      if (!file) {
        reject(new UserError('Upload file is missing'))
        return
      }

      const xhr = new XMLHttpRequest()
      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', 'text/plain')

      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          this.patch(jobId, { progress })
        }
      }
      xhr.onload = () => {
        this.xhrsById.delete(jobId)
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const body = JSON.parse(xhr.responseText) as { id?: string }
            resolve(body.id ?? null)
          } catch {
            resolve(null)
          }
        } else if (
          xhr.status === 403 &&
          xhr.responseText.includes('storageQuotaExceeded')
        ) {
          reject(new QuotaExceededUploadError())
        } else if (
          xhr.status === 408 ||
          xhr.status === 429 ||
          xhr.status >= 500
        ) {
          reject(new TransientUploadError(`Upload failed (${xhr.status})`))
        } else {
          reject(new UserError(`Upload failed (${xhr.status})`))
        }
      }
      xhr.onerror = () => {
        this.xhrsById.delete(jobId)
        reject(new TransientUploadError('Network error during upload'))
      }
      xhr.ontimeout = () => {
        this.xhrsById.delete(jobId)
        reject(new TransientUploadError('Upload timed out'))
      }
      xhr.onabort = () => {
        this.xhrsById.delete(jobId)
        reject(new UserError('Upload cancelled'))
      }

      this.xhrsById.set(jobId, xhr)
      xhr.send(file)
    })
  }
}

export const uploadManager = new UploadManager()

export function useUploads(): UploadJob[] {
  return useSyncExternalStore(
    uploadManager.subscribe,
    uploadManager.getSnapshot,
    uploadManager.getSnapshot
  )
}

interface UploadRevealState {
  albumId: string | null
  nonce: number
}

class UploadRevealStore {
  private state: UploadRevealState = { albumId: null, nonce: 0 }
  private listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): UploadRevealState => this.state

  private emit(next: UploadRevealState): void {
    this.state = next
    this.listeners.forEach((l) => l())
  }

  notify(albumId: string): void {
    this.emit({ albumId, nonce: this.state.nonce + 1 })
  }

  clear(): void {
    if (this.state.albumId === null) return
    this.emit({ albumId: null, nonce: this.state.nonce + 1 })
  }
}

const uploadRevealStore = new UploadRevealStore()

/**
 * Ask album pages to surface their upload list (e.g. when the header progress
 * widget is clicked). Each consumer that matches the album opens its details
 * and then clears the request.
 */
export function revealUploadDetails(albumId: string): void {
  uploadRevealStore.notify(albumId)
}

export function clearUploadReveal(): void {
  uploadRevealStore.clear()
}

export function useUploadReveal(): UploadRevealState {
  return useSyncExternalStore(
    uploadRevealStore.subscribe,
    uploadRevealStore.getSnapshot,
    uploadRevealStore.getSnapshot
  )
}
