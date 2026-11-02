import { createServerFn } from '@tanstack/react-start'

export const getClubCodeFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<string> => {
    const { adminContext } = await import('../server')
    const { getClubCode } = await import('@/lib/access/server')

    const { database } = await adminContext(['admin'])

    return getClubCode(database)
  }
)

export const rotateClubCodeFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<string> => {
    const { adminContext } = await import('../server')
    const { rotateClubCode } = await import('@/lib/access/server')

    const { database } = await adminContext(['admin'])

    return rotateClubCode(database)
  }
)
