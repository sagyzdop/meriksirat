/**
 * Upload persistence: job metadata in localStorage, file payloads in
 * IndexedDB. Lets uploads survive a page refresh — jobs are restored as
 * queued and re-uploaded from the stored `File` objects (browser page loads
 * otherwise destroy both the in-memory job list and the XHR mid-flight).
 *
 * Everything degrades silently to a no-op on the server (SSR) or if storage
 * is unavailable, so uploads keep working in-memory as a fallback.
 */

export interface PersistedJob {
  id: string
  albumId: string
  albumTitle: string
  name: string
  size: number
  mimeType: string
  status: string
  progress: number
  error?: string
}

const JOBS_KEY = 'meriksirat.uploads.jobs.v1'
const DB_NAME = 'meriksirat'
const DB_VERSION = 1
const STORE = 'upload-files'

export function saveJobs(jobs: PersistedJob[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(JOBS_KEY, JSON.stringify(jobs))
  } catch {
    // Storage full or blocked — non-fatal.
  }
}

export function loadJobs(): PersistedJob[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(JOBS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PersistedJob[]) : []
  } catch {
    return []
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveUploadFiles(
  entries: { id: string; file: File }[]
): Promise<void> {
  if (typeof indexedDB === 'undefined' || entries.length === 0) return
  try {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    for (const { id, file } of entries) store.put(file, id)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // Non-fatal: upload still proceeds in-memory.
  }
}

export async function getUploadFiles(ids: string[]): Promise<Map<string, File>> {
  const result = new Map<string, File>()
  if (typeof indexedDB === 'undefined' || ids.length === 0) return result
  try {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    await Promise.all(
      ids.map(
        (id) =>
          new Promise<void>((resolve) => {
            const request = store.get(id)
            request.onsuccess = () => {
              if (request.result instanceof File) result.set(id, request.result)
              resolve()
            }
            request.onerror = () => resolve()
          })
      )
    )
    db.close()
  } catch {
    // Fall through with whatever was read.
  }
  return result
}

export async function deleteUploadFiles(ids: string[]): Promise<void> {
  if (typeof indexedDB === 'undefined' || ids.length === 0) return
  try {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    for (const id of ids) store.delete(id)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // Non-fatal.
  }
}
