/**
 * Telegram Admin Notifications
 * 
 * Handles sending notifications to admin users when equipment is returned.
 */

import { drizzle } from 'drizzle-orm/d1'
import { eq, and, isNotNull } from 'drizzle-orm'
import * as schema from '@/db/schema'
import { TelegramAPI } from './api'
import type { AdminNotification } from './types'

/**
 * Sends equipment return notifications to all admin users with linked Telegram accounts
 * 
 * @param d1Database - D1 database instance from Cloudflare bindings
 * @param notification - Notification data with photo and return details
 * @param telegram - Telegraf Telegram API instance
 * 
 * @example
 * ```typescript
 * await notifyAdmins(ctx.env.meriksirat_d1, {
 *   photoFileId: 'AgACAgIAAxkBAAI...',
 *   userName: 'John Doe',
 *   equipmentNames: 'Laptop, Mouse, Keyboard',
 *   itemCount: 3
 * }, ctx.telegram)
 * ```
 */
export async function notifyAdmins(
  d1Database: D1Database,
  notification: AdminNotification,
  telegram: Telegram
): Promise<void> {
  // Initialize database connection
  const database = drizzle(d1Database, { schema })
  
  // Query all admin users with linked Telegram accounts
  const admins = await database
    .select({
      id: schema.user.id,
      name: schema.user.name,
      telegramChatId: schema.user.telegramChatId,
    })
    .from(schema.user)
    .where(
      and(
        eq(schema.user.role, 'admin'),
        isNotNull(schema.user.telegramChatId)
      )
    )
  
  // Format caption with return details
  const caption = `Return from ${notification.userName}\nItems: ${notification.equipmentNames}\nCount: ${notification.itemCount}`
  
  // Notify each admin individually
  for (const admin of admins) {
    try {
      // Send photo with caption to admin's Telegram chat
      await telegram.sendPhoto(admin.telegramChatId!, notification.photoFileId, {
        caption,
      })
    } catch (error) {
      // Log error with admin context but continue to next admin
      console.error(`Failed to notify admin ${admin.name}:`, {
        adminId: admin.id,
        chatId: admin.telegramChatId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  
}