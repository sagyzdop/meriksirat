import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { MovePreview } from './storage-plan'

const albumIds = z.array(z.string().min(1).max(64)).min(1).max(200)
const fileSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  size: z.number().int().nonnegative(),
  md5: z.string(),
  volumeFolderId: z.string().min(1),
})

export interface OffloadSessionData {
  albumId: string
  files: {
    id: string
    name: string
    size: number
    md5: string
    volumeFolderId: string
    uploaded?: boolean
  }[]
  downloadToken: string
  uploadUrl: string
}

export const previewAlbumMovesFn = createServerFn({ method: 'POST' })
  .validator(z.object({ albumIds, target: z.enum(['buffer', 'flamekeeper']) }))
  .handler(async ({ data }): Promise<MovePreview> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { previewMoves } = await import('./storage-server')
    const { database } = await adminContext(['admin', 'manager'])
    return previewMoves(database, data.albumIds, data.target)
  })

export const moveAlbumsToBufferFn = createServerFn({ method: 'POST' })
  .validator(z.object({ albumIds }))
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { moveAlbumsToBuffer } = await import('./storage-server')
    const { database } = await adminContext(['admin', 'manager'])
    return moveAlbumsToBuffer(database, data.albumIds)
  })

export const startOffloadFn = createServerFn({ method: 'POST' })
  .validator(z.object({ albumIds, origin: z.string().url().optional() }))
  .handler(async ({ data }): Promise<OffloadSessionData[]> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { startOffload } = await import('./storage-server')
    const { database } = await adminContext(['admin', 'manager'])
    return startOffload(database, data.albumIds, data.origin)
  })

export const mintOffloadUploadsFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      albumId: z.string().min(1),
      fileIds: z.array(z.string().min(1)).min(1).max(30),
      origin: z.string().url().optional(),
    })
  )
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { mintOffloadUploads } = await import('./storage-server')
    const { database } = await adminContext(['admin', 'manager'])
    return mintOffloadUploads(database, data)
  })

export const completeOffloadFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      albumId: z.string().min(1),
      files: z.array(fileSchema).max(5000),
    })
  )
  .handler(
    async ({ data }): Promise<{ ok: true } | { ok: false; reason: string }> => {
      const { adminContext } = await import('@/lib/admin/server')
      const { completeOffload } = await import('./storage-server')
      const { database } = await adminContext(['admin', 'manager'])
      const result = await completeOffload(database, data)
      return result.ok ? { ok: true } : { ok: false, reason: result.reason }
    }
  )

export const scheduleAlbumsDeletionFn = createServerFn({ method: 'POST' })
  .validator(z.object({ albumIds }))
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { scheduleAlbumsDeletion } = await import('./storage-server')
    const { database } = await adminContext(['admin', 'manager'])
    return scheduleAlbumsDeletion(database, data.albumIds, env)
  })

export const cancelAlbumsDeletionFn = createServerFn({ method: 'POST' })
  .validator(z.object({ albumIds }))
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { cancelAlbumsDeletion } = await import('./storage-server')
    const { database } = await adminContext(['admin', 'manager'])
    return cancelAlbumsDeletion(database, data.albumIds)
  })
