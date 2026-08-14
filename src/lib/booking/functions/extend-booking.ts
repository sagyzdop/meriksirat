import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { ExtendBookingSchema } from '../types'
import { formatBookingDetailsPlain } from '../details'
import { formatUserDisplayName } from '@/lib/utils'

export const EXTEND_BOOKING_MINUTES = 30

/**
 * Extend a booking by 30 minutes if all its items are available for the extra
 * time. Available to both the booking owner and admins.
 *
 * Behaviour:
 * - The availability check runs only when this function is called (on click).
 * - The booking end time is moved 30 minutes later and every item's calendar
 *   event is updated with the new end time.
 * - Overdue bookings are time-aware: the overdue items are only reset to
 *   `active` and the user's overdue counter is only decremented when the
 *   extended end time is still in the future. If the extended end time is
 *   already in the past, the booking stays overdue until enough extensions are
 *   added to push the end time past now.
 */
export const extendBookingByThirtyMinutesFn = createServerFn({ method: 'POST' })
  .validator(ExtendBookingSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('@/lib/auth/auth')
    const { checkMultipleCalendarsFreeBusy, updateCalendarEvent, toCalendarDateTime, CLUB_TIMEZONE } =
      await import('@/lib/google/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, bookingItem, equipment, user } =
      await import('@/db/schema')
    const { eq, inArray, sql } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { recomputeBookingStatus } = await import('../status')

    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })

    if (!session?.user) {
      throw new Error('Not authenticated')
    }

    const database = db(env.meriksirat_d1 as D1Database)

    const parentRows = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        startedAt: booking.startedAt,
        userEventDetails: booking.userEventDetails,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          telegramUsername: user.telegramUsername,
        },
      })
      .from(booking)
      .leftJoin(user, eq(booking.userId, user.id))
      .where(eq(booking.id, data.bookingId))
      .limit(1)

    const parent = parentRows[0]
    if (!parent) {
      throw new Error('Booking not found')
    }

    if (parent.userId !== session.user.id) {
      const { checkAdminPermission } = await import('@/lib/admin/server')
      await checkAdminPermission(headers, ['admin', 'manager'])
    }

    if (parent.status === 'cancelled' || parent.status === 'returned') {
      throw new Error(
        `A booking with status "${parent.status}" cannot be extended`
      )
    }

    const items = await database
      .select({
        id: bookingItem.id,
        status: bookingItem.status,
        googleCalendarEventId: bookingItem.googleCalendarEventId,
        equipmentCalendarId: equipment.googleCalendarId,
        equipmentId: equipment.id,
        equipmentName: equipment.modelName,
      })
      .from(bookingItem)
      .leftJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
      .where(eq(bookingItem.bookingId, data.bookingId))

    const activeItems = items.filter(
      (item) => item.status !== 'cancelled' && item.status !== 'returned'
    )

    if (activeItems.length === 0) {
      throw new Error('Booking has no items that can be extended')
    }

    const now = new Date()
    const newEndTime = new Date(
      parent.endTime.getTime() + EXTEND_BOOKING_MINUTES * 60 * 1000
    )
    const newEndIsInFuture = newEndTime > now

    const calendarIds = activeItems
      .map((item) => item.equipmentCalendarId)
      .filter((id): id is string => Boolean(id))

    if (calendarIds.length > 0) {
      const freeBusyResult = await checkMultipleCalendarsFreeBusy({
        data: {
          equipmentCalendarIds: calendarIds,
          timeMin: parent.endTime.toISOString(),
          timeMax: newEndTime.toISOString(),
        },
      })

      const conflicts = activeItems
        .filter((item) => item.equipmentCalendarId)
        .map((item) => {
          const busy =
            freeBusyResult[item.equipmentCalendarId as string]?.busy || []
          return busy.length > 0
            ? {
                equipmentName:
                  item.equipmentName || `Equipment ${item.equipmentId}`,
              }
            : null
        })
        .filter((item): item is { equipmentName: string } => Boolean(item))

      if (conflicts.length > 0) {
        throw new Error(
          `Cannot extend the booking: ${conflicts
            .map((c) => c.equipmentName)
            .join(', ')} is not available for the extra 30 minutes`
        )
      }
    }

    await database
      .update(booking)
      .set({ endTime: newEndTime, updatedAt: new Date() })
      .where(eq(booking.id, data.bookingId))

    let undidOverdue = false
    if (newEndIsInFuture) {
      const overdueItemIds = items
        .filter((item) => item.status === 'overdue')
        .map((item) => item.id)

      if (overdueItemIds.length > 0) {
        await database
          .update(bookingItem)
          .set({ status: 'active', updatedAt: new Date() })
          .where(inArray(bookingItem.id, overdueItemIds))

        await database
          .update(user)
          .set({
            overdueCount: sql`CASE WHEN ${user.overdueCount} > 0 THEN ${user.overdueCount} - 1 ELSE 0 END`,
          })
          .where(eq(user.id, parent.userId))

        undidOverdue = true
      }
    }

    await recomputeBookingStatus(database, data.bookingId)

    const userDisplayName = formatUserDisplayName({
      firstName: parent.user?.firstName,
      lastName: parent.user?.lastName,
      name: parent.user?.name,
      telegramUsername: parent.user?.telegramUsername,
    })

    for (const item of activeItems) {
      if (!item.googleCalendarEventId || !item.equipmentCalendarId) continue

      const description = formatBookingDetailsPlain({
        bookingId: data.bookingId,
        userDisplayName,
        equipmentNames: [item.equipmentName || `Equipment ${item.equipmentId}`],
        startTime: parent.startTime,
        endTime: newEndTime,
        startedAt: parent.startedAt,
        status: undidOverdue ? 'active' : parent.status,
        notes: parent.userEventDetails,
      })

      try {
        await updateCalendarEvent({
          data: {
            equipmentCalendarId: item.equipmentCalendarId,
            eventId: item.googleCalendarEventId,
            event: {
              summary: `${item.equipmentName || `Equipment ${item.equipmentId}`}${undidOverdue ? '' : ` (${parent.status.toUpperCase()})`}`,
              description,
              start: {
                dateTime: toCalendarDateTime(parent.startedAt ?? parent.startTime),
                timeZone: CLUB_TIMEZONE,
              },
              end: { dateTime: toCalendarDateTime(newEndTime), timeZone: CLUB_TIMEZONE },
            },
            userEmail: parent.user?.email || '',
          },
        })
      } catch (calendarError) {
        console.error(
          `Failed to update calendar event for item ${item.id}:`,
          calendarError
        )
      }
    }

    const formattedNewEndTime = newEndTime.toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Karachi',
    })

    try {
      await logBookingActivityById(data.bookingId, 'updated', {
        previousStatus: parent.status,
        newStatus: undidOverdue ? 'active' : parent.status,
        notes: `Booking extended by ${EXTEND_BOOKING_MINUTES} minutes to ${formattedNewEndTime}${undidOverdue ? '; overdue status reset' : ''}`,
      })
    } catch (logError) {
      console.error('Failed to log booking extension:', logError)
    }

    return {
      success: true,
      newEndTime: newEndTime.toISOString(),
      undidOverdue,
    }
  })
