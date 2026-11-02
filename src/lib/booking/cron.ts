import { and, eq, gte, isNull, lte, notInArray, sql } from 'drizzle-orm'
import { db } from '@/db/index'
import { booking, bookingItem, equipment, user } from '@/db/schema'
import { formatClubTime } from '@/lib/club-time'
import { cancelWholeBooking } from '@/lib/booking/booking-items'
import {
  buildCalendarEvent,
  equipmentLabel,
} from '@/lib/booking/calendar-events'
import { formatBookingDetailsPlain } from '@/lib/booking/details'
import { recomputeBookingStatus } from '@/lib/booking/status'
import { START_WINDOW_GRACE_MS } from '@/lib/booking/start-booking'
import type { Budget } from '@/lib/cron/budget'
import { updateCalendarEventRaw } from '@/lib/google/google-calendar-client'
import { TelegramAPI } from '@/lib/telegram/api'
import { logBookingActivityById } from '@/lib/telegram/logging'
import { formatUserDisplayName } from '@/lib/utils'

interface CronEnv {
  meriksirat_d1: D1Database
  TELEGRAM_BOT_TOKEN?: string
}

/**
 * Auto-cancel bookings that were never started.
 * A booking is cancelled when its start window has passed (startTime + 15min)
 * without the user starting it. The user's `cancelled_in_start_window_count`
 * is incremented once per booking.
 */
export async function cancelUnstartedBookings(
  env: CronEnv,
  budget: Budget
): Promise<void> {
  const database = db(env.meriksirat_d1)
  const now = new Date()
  const cancelBefore = new Date(now.getTime() - START_WINDOW_GRACE_MS)

  const staleBookings = await database
    .select({
      id: booking.id,
      userId: booking.userId,
      startTime: booking.startTime,
      telegramChatId: user.telegramChatId,
    })
    .from(booking)
    .innerJoin(user, eq(booking.userId, user.id))
    .where(
      and(
        eq(booking.status, 'booked'),
        isNull(booking.startedAt),
        isNull(user.bannedAt),
        lte(booking.startTime, cancelBefore)
      )
    )

  if (staleBookings.length === 0) return

  const botToken = env.TELEGRAM_BOT_TOKEN
  const telegram = botToken ? new TelegramAPI(botToken) : null

  for (const stale of staleBookings) {
    try {
      const proceeded = await cancelWholeBooking(
        database,
        stale.id,
        (itemCount) =>
          budget.take(
            itemCount + 1 + (telegram && stale.telegramChatId ? 1 : 0)
          )
      )
      if (!proceeded) break

      await database
        .update(user)
        .set({
          cancelledInStartWindowCount: sql`${user.cancelledInStartWindowCount} + 1`,
        })
        .where(eq(user.id, stale.userId))

      try {
        await logBookingActivityById(stale.id, 'auto_cancelled')
      } catch (logError) {
        console.error('Failed to log auto-cancel:', logError)
      }

      if (telegram && stale.telegramChatId) {
        try {
          const time = formatClubTime(stale.startTime, false)
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
}

/**
 * Mark held items as overdue.
 * An item becomes overdue 15 minutes after the booking's end time. The
 * calendar event is NOT deleted and its times are NOT changed - only the
 * summary/description status is updated. The user's `overdue_count` is
 * incremented once per booking.
 */
export async function updateOverdueBookings(
  env: CronEnv,
  budget: Budget
): Promise<void> {
  const database = db(env.meriksirat_d1)
  const now = new Date()
  const overdueBefore = new Date(now.getTime() - START_WINDOW_GRACE_MS)

  const overdueItems = await database
    .select({
      id: bookingItem.id,
      bookingId: bookingItem.bookingId,
      googleCalendarEventId: bookingItem.googleCalendarEventId,
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
      and(eq(bookingItem.status, 'active'), lte(booking.endTime, overdueBefore))
    )

  const touchedBookings = new Map<
    number,
    {
      userId: string
      telegramChatId?: string | null
    }
  >()

  const byBooking = new Map<number, typeof overdueItems>()
  for (const item of overdueItems) {
    byBooking.set(item.bookingId, [
      ...(byBooking.get(item.bookingId) ?? []),
      item,
    ])
  }
  const affordable: typeof overdueItems = []
  for (const items of byBooking.values()) {
    const cost =
      items.filter(
        (it) => it.googleCalendarEventId && it.equipment.googleCalendarId
      ).length +
      1 +
      (items[0].user?.telegramChatId && env.TELEGRAM_BOT_TOKEN ? 1 : 0)
    if (!budget.take(cost)) break
    affordable.push(...items)
  }

  for (const item of affordable) {
    try {
      await database
        .update(bookingItem)
        .set({ status: 'overdue', updatedAt: now })
        .where(eq(bookingItem.id, item.id))

      if (!touchedBookings.has(item.bookingId)) {
        touchedBookings.set(item.bookingId, {
          userId: item.booking.userId,
          telegramChatId: item.user?.telegramChatId,
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

        const label = equipmentLabel(
          item.equipment.modelName,
          item.equipment.id
        )
        const event = buildCalendarEvent({
          summary: `${label} (OVERDUE)`,
          description: formatBookingDetailsPlain({
            bookingId: item.bookingId,
            userDisplayName,
            equipmentNames: [label],
            startTime: item.booking.startTime,
            endTime: item.booking.endTime,
            startedAt: item.booking.startedAt,
            status: 'overdue',
            notes: item.booking.userEventDetails,
          }),
          start: eventStart,
          end: item.booking.endTime,
          utc: true,
        })

        await updateCalendarEventRaw({
          equipmentCalendarId: item.equipment.googleCalendarId,
          eventId: item.googleCalendarEventId,
          event,
        })
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

    try {
      await logBookingActivityById(bookingId, 'overdue')
    } catch (logError) {
      console.error('Failed to log overdue booking:', logError)
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
          `⚠️ Booking #${bookingId} is now overdue.\n\nPlease return the equipment as soon as possible via the Return Equipment flow.`
        )
      } catch (error) {
        console.error('Failed to send overdue notification:', error)
      }
    }
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
export async function sendBookingReminders(
  env: CronEnv,
  budget: Budget
): Promise<void> {
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

  const telegram = new TelegramAPI(botToken)

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
    },
    {
      name: 'start_warning' as const,
      condition: and(
        eq(booking.status, 'booked'),
        gte(booking.startTime, nowMinus10),
        lte(booking.startTime, now),
        isNull(booking.startWarningSentAt)
      ),
    },
    {
      name: 'return_warning' as const,
      condition: and(
        gte(booking.endTime, nowMinus10),
        lte(booking.endTime, now),
        notInArray(bookingItem.status, HELD),
        isNull(booking.returnReminderSentAt)
      ),
    },
    {
      name: 'grace_5min' as const,
      condition: and(
        gte(booking.endTime, nowMinus15),
        lte(booking.endTime, nowMinus10),
        notInArray(bookingItem.status, HELD),
        isNull(booking.graceWarningSentAt)
      ),
    },
  ]

  for (const kind of kinds) {
    try {
      const rows = await database
        .select({
          bookingId: booking.id,
          startTime: booking.startTime,
          endTime: booking.endTime,
          equipmentName: equipment.shortName || equipment.modelName,
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
          equipmentNames: string[]
          telegramChatId?: string | null
        }
      >()

      for (const row of rows) {
        const entry = bookingsMap.get(row.bookingId) ?? {
          startTime: new Date(row.startTime),
          endTime: new Date(row.endTime),
          equipmentNames: [],
          telegramChatId: row.telegramChatId,
        }
        entry.equipmentNames.push(row.equipmentName || 'Equipment')
        bookingsMap.set(row.bookingId, entry)
      }

      for (const [bookingId, info] of bookingsMap) {
        if (!info.telegramChatId) continue

        if (!budget.take(1)) return
        try {
          await telegram.sendMessage(
            info.telegramChatId,
            buildReminderMessage(kind.name, info)
          )
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
}

function buildReminderMessage(
  kind: 'pre_start' | 'start_warning' | 'return_warning' | 'grace_5min',
  info: {
    startTime: Date
    endTime: Date
    equipmentNames: string[]
  }
): string {
  const time = (d: Date) => formatClubTime(d, false)
  const equipmentLabel =
    info.equipmentNames.length === 1
      ? info.equipmentNames[0]
      : `${info.equipmentNames.length} items: ${info.equipmentNames.join(', ')}`

  switch (kind) {
    case 'pre_start':
      return `⏰ Booking Reminder\n\nYour booking starts in ~15 minutes.\n\n📦 Equipment: ${equipmentLabel}\n🕐 Time: ${time(info.startTime)} - ${time(info.endTime)}\n\nPlease arrive on time. Tap "▶️ Start Booking" when you pick up the equipment.`
    case 'start_warning':
      return `🔔 Booking Start Time\n\nYour booking was supposed to start now.\n\n📦 Equipment: ${equipmentLabel}\n🕐 Time: ${time(info.startTime)} - ${time(info.endTime)}\n\nTap "▶️ Start Booking" now, or the booking will be automatically cancelled in 15 minutes.`
    case 'return_warning':
      return `⏰ Time's Up\n\nYour booking time has ended.\n\n📦 Equipment: ${equipmentLabel}\n\nPlease return the equipment within the 15-minute grace period. Tap "↩️ Return Equipment" and send a photo of the equipment.`
    case 'grace_5min':
      return `⏰ 5 Minutes Left\n\nYou have 5 minutes left in the grace period to return equipment.\n\n📦 Equipment: ${equipmentLabel}\n\nPlease return it now via "↩️ Return Equipment".`
  }
}
