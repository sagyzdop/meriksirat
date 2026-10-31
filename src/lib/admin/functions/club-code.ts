import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

export const getClubCodeFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<string> => {
    const { checkAdminPermission } = await import('../server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { getClubCode } = await import('@/lib/access/server')

    await checkAdminPermission(getRequestHeaders(), ['admin'])

    return getClubCode(db(env.meriksirat_d1 as D1Database))
  }
)

export const rotateClubCodeFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<string> => {
    const { checkAdminPermission } = await import('../server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { rotateClubCode } = await import('@/lib/access/server')

    await checkAdminPermission(getRequestHeaders(), ['admin'])

    return rotateClubCode(db(env.meriksirat_d1 as D1Database))
  }
)
