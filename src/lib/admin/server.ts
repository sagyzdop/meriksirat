import { env } from 'cloudflare:workers'
import { auth } from '@/lib/auth/auth'
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
  const session = await auth.api.getSession({ headers })

  if (!session?.user) {
    console.warn('Unauthorized admin access attempt: No session')
    throw new Error('Unauthorized: No session')
  }

  // If session already has the required data, use it to avoid a DB hit
  // session.user in better-auth typically contains the user table fields
  const userFromSession = session.user as any
  const hasRequiredFields =
    userFromSession.role !== undefined &&
    userFromSession.clearanceLevel !== undefined &&
    userFromSession.status !== undefined

  let userData: AdminUser

  if (hasRequiredFields) {
    userData = {
      id: userFromSession.id,
      name: userFromSession.name,
      email: userFromSession.email,
      role: userFromSession.role,
      clearanceLevel: userFromSession.clearanceLevel,
      status: userFromSession.status,
      firstName: userFromSession.firstName,
      lastName: userFromSession.lastName,
      telegramUsername: userFromSession.telegramUsername ?? null,
      createdAt: new Date(userFromSession.createdAt),
      updatedAt: new Date(userFromSession.updatedAt),
    }
  } else {
    // Fallback to DB if session is incomplete (unlikely with better-auth default config)
    const database = db(env.meriksirat_d1 as D1Database)
    const dbUser = await database
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
      .get()

    if (!dbUser) {
      console.warn(
        `Unauthorized admin access attempt: User ${session.user.id} not found in database`
      )
      throw new Error('Unauthorized: User not found')
    }
    userData = dbUser as AdminUser
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
