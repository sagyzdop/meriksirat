import { env } from 'cloudflare:workers'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { resolveSession } from '@/lib/auth/resolve-session'
import { db } from '@/db'
import { user } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { AdminUser } from './types'

/**
 * Centralized admin permission checking function
 * Validates user session and role permissions for admin operations
 * Logs unauthorized access attempts for security auditing
 */
export async function checkAdminPermission(
  headers: Headers,
  requiredRoles: ('admin' | 'manager')[]
): Promise<AdminUser> {
  const session = await resolveSession(headers)

  if (!session?.user) {
    console.warn('Unauthorized admin access attempt: No session')
    throw new Error('Unauthorized: No session')
  }

  const database = db(env.meriksirat_d1 as D1Database)
  const userData = (await database
    .select({
      id: user.id,
      email: user.email,
      role: user.role,
      clearanceLevel: user.clearanceLevel,
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      telegramUsername: user.telegramUsername,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .get()) as AdminUser | undefined

  if (!userData) {
    console.warn(
      `Unauthorized admin access attempt: User ${session.user.id} not found in database`
    )
    throw new Error('Unauthorized: User not found')
  }

  const hasPermission = requiredRoles.includes(
    userData.role as 'admin' | 'manager'
  )

  if (!hasPermission) {
    // Log unauthorized access attempt for security auditing
    console.warn(
      `Unauthorized admin access attempt by user ${userData.id} (${userData.email}) with role ${userData.role}. Required roles: ${requiredRoles.join(', ')}`
    )
    throw new Error('Insufficient permissions')
  }

  return userData
}

export async function adminContext(requiredRoles: ('admin' | 'manager')[]) {
  const headers = getRequestHeaders()
  const admin = await checkAdminPermission(headers, requiredRoles)
  return {
    admin,
    headers,
    database: db(env.meriksirat_d1 as D1Database),
  }
}
