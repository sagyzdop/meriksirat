import { eq } from 'drizzle-orm'
import type { Database } from '@/db'
import { flamekeeper, user } from '@/db/schema'
import { type Budget } from '@/lib/cron/budget'
import { formatLongDate } from '@/lib/club-time'
import { sendEmail } from '@/lib/google/email'
import { LOST_GRACE_MS } from './health'

const MAX_EMAILS_PER_RUN = 3

export async function sendReconnectEmails(
  database: Database,
  userIds: string[],
  origin: string,
  now: Date,
  budget: Budget
): Promise<void> {
  let sentCount = 0
  for (const userId of userIds) {
    if (sentCount >= MAX_EMAILS_PER_RUN || !budget.take(1)) break
    const row = await database
      .select({
        email: user.email,
        name: user.name,
        lostSince: flamekeeper.lostSince,
      })
      .from(flamekeeper)
      .innerJoin(user, eq(user.id, flamekeeper.userId))
      .where(eq(flamekeeper.userId, userId))
      .get()
    if (!row?.lostSince) continue
    sentCount++
    const deadline = new Date(row.lostSince.getTime() + LOST_GRACE_MS)
    const deadlineText = formatLongDate(deadline)
    const link = origin ? `${origin}/account` : 'your account page'
    const sent = await sendEmail({
      to: row.email,
      subject: 'Reconnect your Google Drive to keep your flame lit',
      text: `Hi ${row.name},\n\nWe can no longer reach the Google Drive you connected as a flamekeeper (the connection was revoked or expired). Please reconnect it by ${deadlineText}: ${link}\n\nThank you for keeping the flame.`,
    })
    if (sent) {
      await database
        .update(flamekeeper)
        .set({ lostNotifiedAt: now })
        .where(eq(flamekeeper.userId, userId))
    }
  }
}

export async function finalizeLost(
  database: Database,
  userId: string,
  now: Date
): Promise<void> {
  await database
    .update(flamekeeper)
    .set({ lostFinalizedAt: now })
    .where(eq(flamekeeper.userId, userId))
}
