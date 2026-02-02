import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

/**
 * Detect and manage overdue bookings
 * Automatically updates booking status to 'overdue' for bookings past their end time
 */
export const detectOverdueBookingsFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { updateCalendarEvent } = await import('@/lib/google/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, equipment, user } = await import('@/db/schema')
    const { eq, and, or, lt } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    
    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)
    const now = new Date()

    // Find bookings that are past their end time but not yet marked as overdue
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

    const updatedBookingIds: number[] = []

    // Update each overdue booking
    for (const overdueBooking of overdueBookings) {
      try {
        // Update booking status to overdue and add admin note
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

        updatedBookingIds.push(overdueBooking.id)

        // Update calendar event if it exists
        if (overdueBooking.googleCalendarEventId && overdueBooking.equipment?.googleCalendarId) {
          const event = {
            summary: `${overdueBooking.equipment.modelName || `Equipment ${overdueBooking.equipmentId}`} - Booking (OVERDUE)`,
            description: `Booking ID: ${overdueBooking.id}\nUser: ${overdueBooking.user?.email}\nStatus: OVERDUE\nOriginal End Time: ${overdueBooking.endTime.toISOString()}\nMarked overdue: ${now.toISOString()}\nNotes: ${updatedNotes}`,
            start: { dateTime: overdueBooking.endTime.toISOString(), timeZone: 'UTC' },
            end: { dateTime: new Date(overdueBooking.endTime.getTime() + 24 * 60 * 60 * 1000).toISOString(), timeZone: 'UTC' }, // Extend by 1 day
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

        // Log overdue booking detection
        try {
          await logBookingActivityById(overdueBooking.id, 'updated', {
            previousStatus: overdueBooking.status,
            newStatus: 'overdue',
            notes: 'Automatically marked as overdue by system'
          })
        } catch (logError) {
          console.error('Failed to log overdue booking detection:', logError)
        }
      } catch (error) {
        console.error(`Failed to update overdue booking ${overdueBooking.id}:`, error)
      }
    }

    return {
      success: true,
      overdueBookingsFound: overdueBookings.length,
      updatedBookingIds,
    }
  })
