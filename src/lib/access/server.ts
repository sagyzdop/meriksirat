import { eq } from 'drizzle-orm'
import { flamekeeper, settings, user } from '@/db/schema'
import type { db as createDb } from '@/db'
import { generateClubCode } from './club-code'
import { getAccessRules, type AccessRules } from './access-rules'
import { UserError } from '@/lib/user-error'

type Database = ReturnType<typeof createDb>

export async function getClubCode(database: Database): Promise<string> {
  const row = await database
    .select({ clubCode: settings.clubCode })
    .from(settings)
    .where(eq(settings.id, 'global'))
    .get()

  if (row?.clubCode) return row.clubCode
  return rotateClubCode(database)
}

export async function rotateClubCode(database: Database): Promise<string> {
  const code = generateClubCode()
  await database
    .insert(settings)
    .values({ id: 'global', clubCode: code })
    .onConflictDoUpdate({
      target: settings.id,
      set: { clubCode: code, updatedAt: new Date() },
    })
  return code
}

export async function loadAccessRules(
  database: Database,
  userId: string
): Promise<AccessRules> {
  const row = await database
    .select({
      isMember: user.isMember,
      role: user.role,
      email: user.email,
    })
    .from(user)
    .where(eq(user.id, userId))
    .get()

  if (!row) throw new UserError('User not found')

  const fk = await database
    .select({ state: flamekeeper.state })
    .from(flamekeeper)
    .where(eq(flamekeeper.userId, userId))
    .get()

  return getAccessRules({ ...row, flamekeeperState: fk?.state ?? null })
}

export async function assertAccess(
  database: Database,
  userId: string,
  rule: 'canBook' | 'canCreateAlbum',
  message: string
): Promise<void> {
  const rules = await loadAccessRules(database, userId)
  if (!rules[rule]) throw new UserError(message)
}
