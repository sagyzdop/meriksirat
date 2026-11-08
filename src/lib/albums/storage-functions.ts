import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type {
  MovePreview,
  OffloadCompletion,
  OffloadMint,
  OffloadStart,
} from './storage-plan'

const albumIds = z.array(z.string().min(1).max(64)).min(1).max(200)
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
  .validator(z.object({ albumIds }))
  .handler(async ({ data }): Promise<OffloadStart[]> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { startOffload } = await import('./storage-server')
    const { database } = await adminContext(['admin', 'manager'])
    return startOffload(database, data.albumIds)
  })

export const mintOffloadUploadsFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      albumId: z.string().min(1),
      fileIds: z.array(z.string().min(1)).min(1).max(30),
      origin: z.string().url().optional(),
    })
  )
  .handler(async ({ data }): Promise<OffloadMint> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { mintOffloadUploads } = await import('./storage-server')
    const { database } = await adminContext(['admin', 'manager'])
    return mintOffloadUploads(database, data)
  })

export const offloadDownloadTokenFn = createServerFn({ method: 'POST' })
  .validator(z.object({ albumId: z.string().min(1) }))
  .handler(async ({ data }): Promise<string> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { offloadDownloadToken } = await import('./storage-server')
    await adminContext(['admin', 'manager'])
    return offloadDownloadToken(data.albumId)
  })

export const completeOffloadFn = createServerFn({ method: 'POST' })
  .validator(z.object({ albumId: z.string().min(1) }))
  .handler(async ({ data }): Promise<OffloadCompletion> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { completeOffload } = await import('./storage-server')
    const { database } = await adminContext(['admin', 'manager'])
    return completeOffload(database, data.albumId)
  })

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
