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
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // Run all status update and reminder functions in parallel
    ctx.waitUntil(
      Promise.all([
        updateActiveBookings(env),
        updateOverdueBookings(env),
        sendBookingReminders(env),
      ])
    )
  },
}

/**
 * Update booking items that should be marked as active
 * A booking item becomes active when the booking's start time is reached.
 * Parent booking status is recomputed afterwards.
 */
async function updateActiveBookings(env: Env): Promise<void> {
  try {
    const { db } = await import('./src/db/index')
    const { booking, bookingItem, equipment, user } = await import('./src/db/schema')
    const { eq, and, lte } = await import('drizzle-orm')
    const { updateCalendarEvent } = await import('./src/lib/google/google-caledar')
    const { logBookingActivityById } = await import('./src/lib/telegram/logging')
    const { recomputeBookingStatus } = await import('./src/lib/booking/status')

    const database = db(env.meriksirat_d1)
    const now = new Date()

    const activeItems = await database
      .select({
        id: bookingItem.id,
        bookingId: bookingItem.bookingId,
        googleCalendarEventId: bookingItem.googleCalendarEventId,
        status: bookingItem.status,
        booking: {
          userId: booking.userId,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: booking.status,
          userEventDetails: booking.userEventDetails,
        },
        equipment: {
          id: equipment.id,
          modelName: equipment.modelName,
          googleCalendarId: equipment.googleCalendarId,
        },
        user: {
          email: user.email,
        },
      })
      .from(bookingItem)
      .innerJoin(booking, eq(bookingItem.bookingId, booking.id))
      .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
      .leftJoin(user, eq(booking.userId, user.id))
      .where(
        and(
          lte(booking.startTime, now),
          eq(bookingItem.status, 'booked')
        )
      )

    const touchedBookingIds = new Set<number>()

    for (const item of activeItems) {
      try {
        const activeNote = `[System]: Automatically marked as active on ${now.toISOString()}`
        const updatedNotes = item.booking.userEventDetails
          ? `${item.booking.userEventDetails}\n\n${activeNote}`
          : activeNote

        await database
          .update(bookingItem)
          .set({ status: 'active', updatedAt: now })
          .where(eq(bookingItem.id, item.id))

        touchedBookingIds.add(item.bookingId)

        if (item.googleCalendarEventId && item.equipment.googleCalendarId) {
          const event = {
            summary: `${item.equipment.modelName || `Equipment ${item.equipment.id}`} - Booking (ACTIVE)`,
            description: `Booking ID: ${item.bookingId}\nUser: ${item.user?.email}\nStatus: ACTIVE\nStart Time: ${item.booking.startTime.toISOString()}\nEnd Time: ${item.booking.endTime.toISOString()}\nMarked active: ${now.toISOString()}\nNotes: ${updatedNotes}`,
            start: { dateTime: item.booking.startTime.toISOString(), timeZone: 'UTC' },
            end: { dateTime: item.booking.endTime.toISOString(), timeZone: 'UTC' },
          }

          await updateCalendarEvent({
            data: {
              equipmentCalendarId: item.equipment.googleCalendarId,
              eventId: item.googleCalendarEventId,
              event,
              userEmail: item.user?.email || '',
            }
          })
        }

        try {
          await logBookingActivityById(item.bookingId, 'updated', {
            previousStatus: item.status,
            newStatus: 'active',
            notes: `Automatically marked as active by system (item ${item.id})`
          })
        } catch (logError) {
          console.error('Failed to log active booking:', logError)
        }
      } catch (error) {
        console.error(`Failed to update booking item ${item.id}:`, error)
      }
    }

    // Recompute parent statuses after item updates
    for (const bookingId of touchedBookingIds) {
      try {
        await recomputeBookingStatus(database, bookingId)
      } catch (error) {
        console.error(`Failed to recompute status for booking ${bookingId}:`, error)
      }
    }
  } catch (error) {
    console.error('Error in updateActiveBookings:', error)
  }
}

/**
 * Send reminder messages to users 15 minutes before their booking starts
 */
async function sendBookingReminders(env: Env): Promise<void> {
  try {
    const { db } = await import('./src/db/index')
    const { booking, bookingItem, equipment, user } = await import('./src/db/schema')
    const { eq, and, gte, lte } = await import('drizzle-orm')
    const { TelegramAPI } = await import('./src/lib/telegram/api')
    const { sendBookingReminder } = await import('./src/lib/telegram/server-utils')

    const database = db(env.meriksirat_d1)
    const now = new Date()

    // Calculate time window: 15-20 minutes from now
    // This gives us a 5-minute window to catch bookings (since cron runs every 5 minutes)
    const reminderStart = new Date(now.getTime() + 15 * 60 * 1000) // 15 minutes from now
    const reminderEnd = new Date(now.getTime() + 20 * 60 * 1000)   // 20 minutes from now

    const upcomingItems = await database
      .select({
        bookingId: booking.id,
        userId: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        userEventDetails: booking.userEventDetails,
        equipment: {
          modelName: equipment.modelName,
          shortName: equipment.shortName,
        },
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          telegramChatId: user.telegramChatId,
        },
      })
      .from(booking)
      .innerJoin(bookingItem, eq(bookingItem.bookingId, booking.id))
      .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
      .leftJoin(user, eq(booking.userId, user.id))
      .where(
        and(
          gte(booking.startTime, reminderStart),
          lte(booking.startTime, reminderEnd),
          eq(booking.status, 'booked')
        )
      )

    // Get bot token from environment
    const botToken = env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      console.warn('TELEGRAM_BOT_TOKEN not configured, skipping reminders')
      return
    }

    const telegram = new TelegramAPI(botToken)

    // Group items by booking to send one reminder listing all equipment
    const bookingsMap = new Map<number, {
      userId: string
      startTime: Date
      endTime: Date
      userEventDetails: string | null
      equipmentNames: string[]
      telegramChatId?: string | null
      firstName?: string | null
    }>()

    for (const row of upcomingItems) {
      const entry = bookingsMap.get(row.bookingId) ?? {
        userId: row.userId,
        startTime: new Date(row.startTime),
        endTime: new Date(row.endTime),
        userEventDetails: row.userEventDetails,
        equipmentNames: [],
        telegramChatId: row.user?.telegramChatId,
        firstName: row.user?.firstName,
      }
      entry.equipmentNames.push(row.equipment?.shortName || row.equipment?.modelName || 'Equipment')
      bookingsMap.set(row.bookingId, entry)
    }

    for (const [bookingId, bookingInfo] of bookingsMap) {
      try {
        // Skip if user doesn't have Telegram linked
        if (!bookingInfo.telegramChatId) {
          continue
        }

        await sendBookingReminder(telegram, bookingInfo.telegramChatId, {
          userName: bookingInfo.firstName || 'there',
          equipmentNames: bookingInfo.equipmentNames,
          startTime: bookingInfo.startTime,
          endTime: bookingInfo.endTime,
          notes: bookingInfo.userEventDetails,
        })

      } catch (error) {
        console.error(`Failed to send reminder for booking ${bookingId}:`, error)
      }
    }
  } catch (error) {
    console.error('Error in sendBookingReminders:', error)
  }
}

/**
 * Update booking items that should be marked as overdue
 * An item becomes overdue when the booking's end time has passed.
 * Parent booking status is recomputed afterwards.
 */
async function updateOverdueBookings(env: Env): Promise<void> {
  try {
    const { db } = await import('./src/db/index')
    const { booking, bookingItem, equipment, user } = await import('./src/db/schema')
    const { eq, and, or, lt, inArray } = await import('drizzle-orm')
    const { updateCalendarEvent } = await import('./src/lib/google/google-caledar')
    const { logBookingActivityById } = await import('./src/lib/telegram/logging')
    const { recomputeBookingStatus } = await import('./src/lib/booking/status')

    const database = db(env.meriksirat_d1)
    const now = new Date()

    const overdueItems = await database
      .select({
        id: bookingItem.id,
        bookingId: bookingItem.bookingId,
        googleCalendarEventId: bookingItem.googleCalendarEventId,
        status: bookingItem.status,
        booking: {
          userId: booking.userId,
          endTime: booking.endTime,
          userEventDetails: booking.userEventDetails,
        },
        equipment: {
          id: equipment.id,
          modelName: equipment.modelName,
          googleCalendarId: equipment.googleCalendarId,
        },
        user: {
          email: user.email,
        },
      })
      .from(bookingItem)
      .innerJoin(booking, eq(bookingItem.bookingId, booking.id))
      .innerJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
      .leftJoin(user, eq(booking.userId, user.id))
      .where(
        and(
          lt(booking.endTime, now),
          or(
            eq(bookingItem.status, 'booked'),
            eq(bookingItem.status, 'active')
          )
        )
      )

    const touchedBookingIds = new Set<number>()

    for (const item of overdueItems) {
      try {
        const overdueNote = `[System]: Automatically marked as overdue on ${now.toISOString()}`
        const updatedNotes = item.booking.userEventDetails
          ? `${item.booking.userEventDetails}\n\n${overdueNote}`
          : overdueNote

        await database
          .update(bookingItem)
          .set({ status: 'overdue', updatedAt: now })
          .where(eq(bookingItem.id, item.id))

        touchedBookingIds.add(item.bookingId)

        if (item.googleCalendarEventId && item.equipment.googleCalendarId) {
          const event = {
            summary: `${item.equipment.modelName || `Equipment ${item.equipment.id}`} - Booking (OVERDUE)`,
            description: `Booking ID: ${item.bookingId}\nUser: ${item.user?.email}\nStatus: OVERDUE\nOriginal End Time: ${item.booking.endTime.toISOString()}\nMarked overdue: ${now.toISOString()}\nNotes: ${updatedNotes}`,
            start: { dateTime: item.booking.endTime.toISOString(), timeZone: 'UTC' },
            end: { dateTime: new Date(item.booking.endTime.getTime() + 24 * 60 * 60 * 1000).toISOString(), timeZone: 'UTC' },
          }

          await updateCalendarEvent({
            data: {
              equipmentCalendarId: item.equipment.googleCalendarId,
              eventId: item.googleCalendarEventId,
              event,
              userEmail: item.user?.email || '',
            }
          })
        }

        try {
          await logBookingActivityById(item.bookingId, 'updated', {
            previousStatus: item.status,
            newStatus: 'overdue',
            notes: `Automatically marked as overdue by system (item ${item.id})`
          })
        } catch (logError) {
          console.error('Failed to log overdue booking:', logError)
        }
      } catch (error) {
        console.error(`Failed to update booking item ${item.id}:`, error)
      }
    }

    // Recompute parent statuses after item updates
    for (const bookingId of touchedBookingIds) {
      try {
        await recomputeBookingStatus(database, bookingId)
      } catch (error) {
        console.error(`Failed to recompute status for booking ${bookingId}:`, error)
      }
    }
  } catch (error) {
    console.error('Error in updateOverdueBookings:', error)
  }
}
