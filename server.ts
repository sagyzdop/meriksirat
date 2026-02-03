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
    console.log('Cron trigger fired at:', new Date(controller.scheduledTime).toISOString())
    console.log('Cron pattern:', controller.cron)

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
 * Update bookings that should be marked as active
 * Uses the logic from src/lib/booking/functions/active-bookings.ts
 */
async function updateActiveBookings(env: Env): Promise<void> {
  try {
    const { db } = await import('./src/db/index')
    const { booking, equipment, user } = await import('./src/db/schema')
    const { eq, and, lte } = await import('drizzle-orm')
    const { updateCalendarEvent } = await import('./src/lib/google/google-caledar')
    const { logBookingActivityById } = await import('./src/lib/telegram/logging')

    const database = db(env.meriksirat_d1)
    const now = new Date()

    const activeBookings = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        equipmentId: booking.equipmentId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        googleCalendarEventId: booking.googleCalendarEventId,
        userEventDetails: booking.userEventDetails,
        equipment: {
          modelName: equipment.modelName,
          googleCalendarId: equipment.googleCalendarId,
        },
        user: {
          email: user.email,
        },
      })
      .from(booking)
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .leftJoin(user, eq(booking.userId, user.id))
      .where(
        and(
          lte(booking.startTime, now),
          eq(booking.status, 'booked')
        )
      )

    console.log(`Found ${activeBookings.length} bookings to mark as active`)

    for (const activeBooking of activeBookings) {
      try {
        const activeNote = `[System]: Automatically marked as active on ${now.toISOString()}`
        const updatedNotes = activeBooking.userEventDetails 
          ? `${activeBooking.userEventDetails}\n\n${activeNote}`
          : activeNote

        await database
          .update(booking)
          .set({
            status: 'active',
            userEventDetails: updatedNotes,
            updatedAt: now,
          })
          .where(eq(booking.id, activeBooking.id))

        console.log(`Updated booking ${activeBooking.id} to active`)

        if (activeBooking.googleCalendarEventId && activeBooking.equipment?.googleCalendarId) {
          const event = {
            summary: `${activeBooking.equipment.modelName || `Equipment ${activeBooking.equipmentId}`} - Booking (ACTIVE)`,
            description: `Booking ID: ${activeBooking.id}\nUser: ${activeBooking.user?.email}\nStatus: ACTIVE\nStart Time: ${activeBooking.startTime.toISOString()}\nEnd Time: ${activeBooking.endTime.toISOString()}\nMarked active: ${now.toISOString()}\nNotes: ${updatedNotes}`,
            start: { dateTime: activeBooking.startTime.toISOString(), timeZone: 'UTC' },
            end: { dateTime: activeBooking.endTime.toISOString(), timeZone: 'UTC' },
          }

          await updateCalendarEvent({
            data: {
              equipmentCalendarId: activeBooking.equipment.googleCalendarId,
              eventId: activeBooking.googleCalendarEventId,
              event,
              userEmail: activeBooking.user?.email || '',
            }
          })
        }

        try {
          await logBookingActivityById(activeBooking.id, 'updated', {
            previousStatus: activeBooking.status,
            newStatus: 'active',
            notes: 'Automatically marked as active by system'
          })
        } catch (logError) {
          console.error('Failed to log active booking:', logError)
        }
      } catch (error) {
        console.error(`Failed to update booking ${activeBooking.id}:`, error)
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
    const { booking, equipment, user } = await import('./src/db/schema')
    const { eq, and, gte, lte } = await import('drizzle-orm')
    const { TelegramAPI } = await import('./src/lib/telegram/api')
    const { sendBookingReminder } = await import('./src/lib/telegram/server-utils')

    const database = db(env.meriksirat_d1)
    const now = new Date()
    
    // Calculate time window: 15-20 minutes from now
    // This gives us a 5-minute window to catch bookings (since cron runs every 5 minutes)
    const reminderStart = new Date(now.getTime() + 15 * 60 * 1000) // 15 minutes from now
    const reminderEnd = new Date(now.getTime() + 20 * 60 * 1000)   // 20 minutes from now

    const upcomingBookings = await database
      .select({
        id: booking.id,
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
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .leftJoin(user, eq(booking.userId, user.id))
      .where(
        and(
          gte(booking.startTime, reminderStart),
          lte(booking.startTime, reminderEnd),
          eq(booking.status, 'booked')
        )
      )

    console.log(`Found ${upcomingBookings.length} bookings to send reminders for`)

    // Get bot token from environment
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      console.warn('TELEGRAM_BOT_TOKEN not configured, skipping reminders')
      return
    }

    const telegram = new TelegramAPI(botToken)

    for (const upcomingBooking of upcomingBookings) {
      try {
        // Skip if user doesn't have Telegram linked
        if (!upcomingBooking.user?.telegramChatId) {
          console.log(`Skipping reminder for booking ${upcomingBooking.id}: user has no Telegram linked`)
          continue
        }

        const userName = upcomingBooking.user.firstName || 'there'
        const equipmentName = upcomingBooking.equipment?.shortName || upcomingBooking.equipment?.modelName || 'Equipment'

        await sendBookingReminder(telegram, upcomingBooking.user.telegramChatId, {
          userName,
          equipmentName,
          startTime: new Date(upcomingBooking.startTime),
          endTime: new Date(upcomingBooking.endTime),
          notes: upcomingBooking.userEventDetails,
        })

        console.log(`Sent reminder for booking ${upcomingBooking.id} to user ${upcomingBooking.userId}`)
      } catch (error) {
        console.error(`Failed to send reminder for booking ${upcomingBooking.id}:`, error)
      }
    }
  } catch (error) {
    console.error('Error in sendBookingReminders:', error)
  }
}

/**
 * Update bookings that should be marked as overdue
 * Uses the logic from src/lib/booking/functions/overdue-bookings.ts
 */
async function updateOverdueBookings(env: Env): Promise<void> {
  try {
    const { db } = await import('./src/db/index')
    const { booking, equipment, user } = await import('./src/db/schema')
    const { eq, and, or, lt } = await import('drizzle-orm')
    const { updateCalendarEvent } = await import('./src/lib/google/google-caledar')
    const { logBookingActivityById } = await import('./src/lib/telegram/logging')

    const database = db(env.meriksirat_d1)
    const now = new Date()

    const overdueBookings = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        equipmentId: booking.equipmentId,
        endTime: booking.endTime,
        status: booking.status,
        googleCalendarEventId: booking.googleCalendarEventId,
        userEventDetails: booking.userEventDetails,
        equipment: {
          modelName: equipment.modelName,
          googleCalendarId: equipment.googleCalendarId,
        },
        user: {
          email: user.email,
        },
      })
      .from(booking)
      .leftJoin(equipment, eq(booking.equipmentId, equipment.id))
      .leftJoin(user, eq(booking.userId, user.id))
      .where(
        and(
          lt(booking.endTime, now),
          or(
            eq(booking.status, 'booked'),
            eq(booking.status, 'active')
          )
        )
      )

    console.log(`Found ${overdueBookings.length} bookings to mark as overdue`)

    for (const overdueBooking of overdueBookings) {
      try {
        const overdueNote = `[System]: Automatically marked as overdue on ${now.toISOString()}`
        const updatedNotes = overdueBooking.userEventDetails 
          ? `${overdueBooking.userEventDetails}\n\n${overdueNote}`
          : overdueNote

        await database
          .update(booking)
          .set({
            status: 'overdue',
            userEventDetails: updatedNotes,
            updatedAt: now,
          })
          .where(eq(booking.id, overdueBooking.id))

        console.log(`Updated booking ${overdueBooking.id} to overdue`)

        if (overdueBooking.googleCalendarEventId && overdueBooking.equipment?.googleCalendarId) {
          const event = {
            summary: `${overdueBooking.equipment.modelName || `Equipment ${overdueBooking.equipmentId}`} - Booking (OVERDUE)`,
            description: `Booking ID: ${overdueBooking.id}\nUser: ${overdueBooking.user?.email}\nStatus: OVERDUE\nOriginal End Time: ${overdueBooking.endTime.toISOString()}\nMarked overdue: ${now.toISOString()}\nNotes: ${updatedNotes}`,
            start: { dateTime: overdueBooking.endTime.toISOString(), timeZone: 'UTC' },
            end: { dateTime: new Date(overdueBooking.endTime.getTime() + 24 * 60 * 60 * 1000).toISOString(), timeZone: 'UTC' },
          }

          await updateCalendarEvent({
            data: {
              equipmentCalendarId: overdueBooking.equipment.googleCalendarId,
              eventId: overdueBooking.googleCalendarEventId,
              event,
              userEmail: overdueBooking.user?.email || '',
            }
          })
        }

        try {
          await logBookingActivityById(overdueBooking.id, 'updated', {
            previousStatus: overdueBooking.status,
            newStatus: 'overdue',
            notes: 'Automatically marked as overdue by system'
          })
        } catch (logError) {
          console.error('Failed to log overdue booking:', logError)
        }
      } catch (error) {
        console.error(`Failed to update booking ${overdueBooking.id}:`, error)
      }
    }
  } catch (error) {
    console.error('Error in updateOverdueBookings:', error)
  }
}
