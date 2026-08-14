/**
 * Custom Cloudflare Workers entry point
 * Handles both HTTP requests and scheduled cron triggers
 *
 * Based on TanStack Start documentation:
 * https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack/
 */

import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

interface Env {
  meriksirat_d1: D1Database
  meriksirat_r2: R2Bucket
  meriksirat_kv: KVNamespace
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_CLUB_CHANNEL_ID?: string
}

const serverEntry = createServerEntry({
  async fetch(request) {
    return await handler.fetch(request)
  },
})

export default {
  ...serverEntry,

  // Handle scheduled cron triggers
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // Run all status update and reminder functions in parallel
    ctx.waitUntil(
      Promise.all([
        cancelUnstartedBookings(env),
        updateOverdueBookings(env),
        sendBookingReminders(env),
        configureTelegramBot(env),
      ])
    )
  },
}

const GRACE_MS = 15 * 60 * 1000

/**
 * Keeps the bot's global configuration in sync (clears the command menu so the
 * bot is driven purely by the inline-button interface).
 */
async function configureTelegramBot(env: Env): Promise<void> {
  try {
    const { configureTelegramBot: configure } =
      await import('./src/lib/telegram/configure')
    await configure(env)
  } catch (error) {
    console.error('Error in configureTelegramBot:', error)
  }
}

/**
 * Auto-cancel bookings that were never started.
 * A booking is cancelled when its start window has passed (startTime + 15min)
 * without the user starting it. The user's `cancelled_in_start_window_count`
 * is incremented once per booking.
 */
async function cancelUnstartedBookings(env: Env): Promise<void> {
  try {
    const { db } = await import('./src/db/index')
    const { booking, bookingItem, user } = await import('./src/db/schema')
    const { eq, and, isNull, lte, sql } = await import('drizzle-orm')
    const { cancelBookingItems } =
      await import('./src/lib/booking/booking-items')
    const { logBookingActivityById } =
      await import('./src/lib/telegram/logging')
    const { TelegramAPI } = await import('./src/lib/telegram/api')

    const database = db(env.meriksirat_d1)
    const now = new Date()
    const cancelBefore = new Date(now.getTime() - GRACE_MS)

    const staleBookings = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        telegramChatId: user.telegramChatId,
        firstName: user.firstName,
      })
      .from(booking)
      .innerJoin(user, eq(booking.userId, user.id))
      .where(
        and(
          eq(booking.status, 'booked'),
          isNull(booking.startedAt),
          lte(booking.startTime, cancelBefore)
        )
      )

    if (staleBookings.length === 0) return

    const botToken = env.TELEGRAM_BOT_TOKEN
    const telegram = botToken ? new TelegramAPI(botToken) : null

    for (const stale of staleBookings) {
      try {
        const items = await database
          .select({ id: bookingItem.id })
          .from(bookingItem)
          .where(eq(bookingItem.bookingId, stale.id))

        if (items.length > 0) {
          await cancelBookingItems(
            database,
            items.map((it) => it.id)
          )
        }

        await database
          .update(user)
          .set({
            cancelledInStartWindowCount: sql`${user.cancelledInStartWindowCount} + 1`,
          })
          .where(eq(user.id, stale.userId))

        try {
          await logBookingActivityById(stale.id, 'cancelled', {
            previousStatus: 'booked',
            newStatus: 'cancelled',
            notes:
              'Booking auto-cancelled: equipment was not picked up within 15 minutes of the start time',
          })
        } catch (logError) {
          console.error('Failed to log auto-cancel:', logError)
        }

        if (telegram && stale.telegramChatId) {
          try {
            const time = stale.startTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })
            await telegram.sendMessage(
              stale.telegramChatId,
              `❌ Booking #${stale.id} was auto-cancelled.\n\nYou did not pick up your equipment within 15 minutes of the start time (${time}). If this wasn't intentional, please make a new booking.`
            )
          } catch (sendError) {
            console.error(
              `Failed to notify auto-cancel for booking ${stale.id}:`,
              sendError
            )
          }
        }
      } catch (error) {
        console.error(`Failed to auto-cancel booking ${stale.id}:`, error)
      }
    }
  } catch (error) {
    console.error('Error in cancelUnstartedBookings:', error)
  }
}

/**
 * Mark held items as overdue.
 * An item becomes overdue 15 minutes after the booking's end time. The
 * calendar event is NOT deleted and its times are NOT changed - only the
 * summary/description status is updated. The user's `overdue_count` is
 * incremented once per booking.
 */
async function updateOverdueBookings(env: Env): Promise<void> {
  try {
    const { db } = await import('./src/db/index')
    const { booking, bookingItem, equipment, user } =
      await import('./src/db/schema')
    const { eq, and, lte, sql } = await import('drizzle-orm')
    const { updateCalendarEvent } =
      await import('./src/lib/google/google-caledar')
    const { logBookingActivityById } =
      await import('./src/lib/telegram/logging')
    const { recomputeBookingStatus } = await import('./src/lib/booking/status')
    const { formatBookingDetailsPlain } =
      await import('./src/lib/booking/details')
    const { formatUserDisplayName } = await import('./src/lib/utils')
    const { TelegramAPI } = await import('./src/lib/telegram/api')

    const database = db(env.meriksirat_d1)
    const now = new Date()
    const overdueBefore = new Date(now.getTime() - GRACE_MS)

    const overdueItems = await database
      .select({
        id: bookingItem.id,
        bookingId: bookingItem.bookingId,
        googleCalendarEventId: bookingItem.googleCalendarEventId,
        status: bookingItem.status,
        booking: {
          userId: booking.userId,
          startTime: booking.startTime,
          endTime: booking.endTime,
          startedAt: booking.startedAt,
          userEventDetails: booking.userEventDetails,
        },
        equipment: {
          id: equipment.id,
          modelName: equipment.modelName,
          googleCalendarId: equipment.googleCalendarId,
        },
        user: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          telegramUsername: user.telegramUsername,
          telegramChatId: user.telegramChatId,
        },
      })
      .from(bookingItem)
      .innerJoin(booking, eq(bookingItem.bookingId, booking.id))
      .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
      .leftJoin(user, eq(booking.userId, user.id))
      .where(
        and(
          eq(bookingItem.status, 'active'),
          lte(booking.endTime, overdueBefore)
        )
      )

    const touchedBookings = new Map<
      number,
      {
        userId: string
        telegramChatId?: string | null
        firstName?: string | null
      }
    >()

    for (const item of overdueItems) {
      try {
        await database
          .update(bookingItem)
          .set({ status: 'overdue', updatedAt: now })
          .where(eq(bookingItem.id, item.id))

        if (!touchedBookings.has(item.bookingId)) {
          touchedBookings.set(item.bookingId, {
            userId: item.booking.userId,
            telegramChatId: item.user?.telegramChatId,
            firstName: item.user?.firstName,
          })
        }

        if (item.googleCalendarEventId && item.equipment.googleCalendarId) {
          const userDisplayName = formatUserDisplayName({
            firstName: item.user?.firstName,
            lastName: item.user?.lastName,
            name: item.user?.name,
            telegramUsername: item.user?.telegramUsername,
          })

          const eventStart = item.booking.startedAt ?? item.booking.startTime

          const event = {
            summary: `${item.equipment.modelName || `Equipment ${item.equipment.id}`} (OVERDUE)`,
            description: formatBookingDetailsPlain({
              bookingId: item.bookingId,
              userDisplayName,
              equipmentNames: [
                item.equipment.modelName || `Equipment ${item.equipment.id}`,
              ],
              startTime: item.booking.startTime,
              endTime: item.booking.endTime,
              startedAt: item.booking.startedAt,
              status: 'overdue',
              notes: item.booking.userEventDetails,
            }),
            // Times are never changed by the overdue transition.
            start: { dateTime: eventStart.toISOString(), timeZone: 'UTC' },
            end: {
              dateTime: item.booking.endTime.toISOString(),
              timeZone: 'UTC',
            },
          }

          await updateCalendarEvent({
            data: {
              equipmentCalendarId: item.equipment.googleCalendarId,
              eventId: item.googleCalendarEventId,
              event,
              userEmail: item.user?.email || '',
            },
          })
        }

        try {
          await logBookingActivityById(item.bookingId, 'updated', {
            previousStatus: 'active',
            newStatus: 'overdue',
            notes: `Automatically marked as overdue by system (item ${item.id})`,
          })
        } catch (logError) {
          console.error('Failed to log overdue booking:', logError)
        }
      } catch (error) {
        console.error(`Failed to update booking item ${item.id}:`, error)
      }
    }

    // Recompute parent statuses and increment violation counters once per booking.
    for (const [bookingId, info] of touchedBookings) {
      try {
        await recomputeBookingStatus(database, bookingId)
      } catch (error) {
        console.error(
          `Failed to recompute status for booking ${bookingId}:`,
          error
        )
      }

      try {
        await database
          .update(user)
          .set({ overdueCount: sql`${user.overdueCount} + 1` })
          .where(eq(user.id, info.userId))
      } catch (error) {
        console.error(
          `Failed to increment overdue count for user ${info.userId}:`,
          error
        )
      }
    }

    // Notify users their booking is now overdue.
    if (env.TELEGRAM_BOT_TOKEN) {
      const telegram = new TelegramAPI(env.TELEGRAM_BOT_TOKEN)
      for (const [bookingId, info] of touchedBookings) {
        if (!info.telegramChatId) continue
        try {
          await telegram.sendMessage(
            info.telegramChatId,
            `⚠️ Booking #${bookingId} is now overdue.\n\nPlease return the equipment as soon as possible via the End Booking flow.`
          )
        } catch (error) {
          console.error('Failed to send overdue notification:', error)
        }
      }
    }
  } catch (error) {
    console.error('Error in updateOverdueBookings:', error)
  }
}

/**
 * Send booking reminders via Telegram. Runs on the cron schedule (every 5 min).
 *
 * Four reminders, each idempotent via a tracking column:
 * - pre_start:     ~15 min before start time       (booking.start_reminder_sent_at)
 * - start_warning: at/just after start time        (booking.start_warning_sent_at)
 * - return_warning: at/just after end time         (booking.return_reminder_sent_at)
 * - grace_5min:    10-15 min after end time        (booking.grace_warning_sent_at)
 */
async function sendBookingReminders(env: Env): Promise<void> {
  try {
    const { db } = await import('./src/db/index')
    const { booking, bookingItem, equipment, user } =
      await import('./src/db/schema')
    const { eq, and, gte, lte, isNull, notInArray } =
      await import('drizzle-orm')

    const database = db(env.meriksirat_d1)
    const now = new Date()
    const nowMinus10 = new Date(now.getTime() - 10 * 60 * 1000)
    const nowMinus15 = new Date(now.getTime() - 15 * 60 * 1000)
    const nowPlus15 = new Date(now.getTime() + 15 * 60 * 1000)
    const nowPlus20 = new Date(now.getTime() + 20 * 60 * 1000)

    const botToken = env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      console.warn('TELEGRAM_BOT_TOKEN not configured, skipping reminders')
      return
    }

    const telegram = new (await import('./src/lib/telegram/api')).TelegramAPI(
      botToken
    )

    const HELD: ('returned' | 'cancelled')[] = ['returned', 'cancelled']

    const TRACKING_COLUMNS = {
      pre_start: 'startReminderSentAt',
      start_warning: 'startWarningSentAt',
      return_warning: 'returnReminderSentAt',
      grace_5min: 'graceWarningSentAt',
    } as const

    const kinds = [
      {
        name: 'pre_start' as const,
        condition: and(
          eq(booking.status, 'booked'),
          gte(booking.startTime, nowPlus15),
          lte(booking.startTime, nowPlus20),
          isNull(booking.startReminderSentAt)
        ),
        trackingColumn: booking.startReminderSentAt,
      },
      {
        name: 'start_warning' as const,
        condition: and(
          eq(booking.status, 'booked'),
          gte(booking.startTime, nowMinus10),
          lte(booking.startTime, now),
          isNull(booking.startWarningSentAt)
        ),
        trackingColumn: booking.startWarningSentAt,
      },
      {
        name: 'return_warning' as const,
        condition: and(
          gte(booking.endTime, nowMinus10),
          lte(booking.endTime, now),
          notInArray(bookingItem.status, HELD),
          isNull(booking.returnReminderSentAt)
        ),
        trackingColumn: booking.returnReminderSentAt,
      },
      {
        name: 'grace_5min' as const,
        condition: and(
          gte(booking.endTime, nowMinus15),
          lte(booking.endTime, nowMinus10),
          notInArray(bookingItem.status, HELD),
          isNull(booking.graceWarningSentAt)
        ),
        trackingColumn: booking.graceWarningSentAt,
      },
    ]

    for (const kind of kinds) {
      try {
        const rows = await database
          .select({
            bookingId: booking.id,
            startTime: booking.startTime,
            endTime: booking.endTime,
            status: booking.status,
            userEventDetails: booking.userEventDetails,
            equipmentName: equipment.shortName || equipment.modelName,
            firstName: user.firstName,
            telegramChatId: user.telegramChatId,
          })
          .from(booking)
          .innerJoin(bookingItem, eq(bookingItem.bookingId, booking.id))
          .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
          .leftJoin(user, eq(booking.userId, user.id))
          .where(kind.condition)

        const bookingsMap = new Map<
          number,
          {
            startTime: Date
            endTime: Date
            status: string
            equipmentNames: string[]
            telegramChatId?: string | null
            firstName?: string | null
          }
        >()

        for (const row of rows) {
          const entry = bookingsMap.get(row.bookingId) ?? {
            startTime: new Date(row.startTime),
            endTime: new Date(row.endTime),
            status: row.status,
            equipmentNames: [],
            telegramChatId: row.telegramChatId,
            firstName: row.firstName,
          }
          entry.equipmentNames.push(row.equipmentName || 'Equipment')
          bookingsMap.set(row.bookingId, entry)
        }

        for (const [bookingId, info] of bookingsMap) {
          if (!info.telegramChatId) continue

          const message = buildReminderMessage(kind.name, info)
          if (!message) continue

          try {
            await telegram.sendMessage(info.telegramChatId, message)
            await database
              .update(booking)
              .set({ [TRACKING_COLUMNS[kind.name]]: new Date() })
              .where(eq(booking.id, bookingId))
          } catch (error) {
            console.error(
              `Failed to send ${kind.name} reminder for booking ${bookingId}:`,
              error
            )
          }
        }
      } catch (error) {
        console.error(`Error processing ${kind.name} reminders:`, error)
      }
    }
  } catch (error) {
    console.error('Error in sendBookingReminders:', error)
  }
}

function buildReminderMessage(
  kind: 'pre_start' | 'start_warning' | 'return_warning' | 'grace_5min',
  info: {
    startTime: Date
    endTime: Date
    equipmentNames: string[]
  }
): string {
  const time = (d: Date) =>
    d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  const equipmentLabel =
    info.equipmentNames.length === 1
      ? info.equipmentNames[0]
      : `${info.equipmentNames.length} items: ${info.equipmentNames.join(', ')}`

  switch (kind) {
    case 'pre_start':
      return `⏰ Booking Reminder\n\nYour booking starts in ~15 minutes.\n\n📦 Equipment: ${equipmentLabel}\n🕐 Time: ${time(info.startTime)} - ${time(info.endTime)}\n\nPlease arrive on time. Use the "Start Booking" button when you pick up the equipment.`
    case 'start_warning':
      return `🔔 Booking Start Time\n\nYour booking was supposed to start now.\n\n📦 Equipment: ${equipmentLabel}\n🕐 Time: ${time(info.startTime)} - ${time(info.endTime)}\n\nPress "Start Booking" now, or the booking will be automatically cancelled in 15 minutes.`
    case 'return_warning':
      return `⏰ Time's Up\n\nYour booking time has ended.\n\n📦 Equipment: ${equipmentLabel}\n\nPlease return the equipment within the 15-minute grace period. Use the "End Booking" button and send a photo of the equipment.`
    case 'grace_5min':
      return `⏰ 5 Minutes Left\n\nYou have 5 minutes left in the grace period to return equipment.\n\n📦 Equipment: ${equipmentLabel}\n\nPlease return it now via the "End Booking" button.`
  }
}
