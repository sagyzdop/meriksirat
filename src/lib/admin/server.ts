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

  const database = db(env.meriksirat_d1 as D1Database)
  const userData = await database
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      clearanceLevel: user.clearanceLevel,
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .get()

  if (!userData) {
    console.warn(`Unauthorized admin access attempt: User ${session.user.id} not found in database`)
    throw new Error('Unauthorized: User not found')
  }

  const hasPermission = requiredRoles.includes(userData.role as 'admin' | 'manager')
  
  if (!hasPermission) {
    // Log unauthorized access attempt for security auditing
    console.warn(`Unauthorized admin access attempt by user ${userData.id} (${userData.email}) with role ${userData.role}. Required roles: ${requiredRoles.join(', ')}`)
    throw new Error('Insufficient permissions')
  }
  
  return userData as AdminUser
}
