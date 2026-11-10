import { createServerFn } from '@tanstack/react-start'
import type {
  PaginatedAdminBookingsResponse,
  AdminBookingWithDetails,
} from '../types'
import {
  AdminBookingFiltersSchema,
  UpdateBookingStatusAdminSchema,
  GetBookingByIdSchema,
} from '../types'
import { formatUserDisplayName } from '@/lib/utils'
import { formatBookingDetailsPlain } from '../details'
import { buildPageInfo } from '@/lib/pagination'
import { UserError } from '@/lib/user-error'

/**
 * Get all bookings with comprehensive filtering and pagination for admin oversight
 * Includes user and equipment details for administrative management
 */
export const getAdminBookingsFn = createServerFn({ method: 'GET' })
  .validator(AdminBookingFiltersSchema)
  .handler(async ({ data }): Promise<PaginatedAdminBookingsResponse> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { booking, bookingItem, equipment, user, category } =
      await import('@/db/schema')
    const { eq, and } = await import('drizzle-orm')
    const {
      attachItems,
      bookingFilterConditions,
      bookingOrder,
      countBookings,
    } = await import('../list-query')

    const { database } = await adminContext(['admin', 'manager'])

    const whereClause = and(...bookingFilterConditions(data))

    const [total, pageBookings] = await Promise.all([
      countBookings(database, whereClause),
      database
        .select({
          id: booking.id,
          userId: booking.userId,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: booking.status,
          userEventDetails: booking.userEventDetails,
          startedAt: booking.startedAt,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            image: user.image,
          },
        })
        .from(booking)
        .leftJoin(user, eq(booking.userId, user.id))
        .leftJoin(bookingItem, eq(bookingItem.bookingId, booking.id))
        .leftJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
        .leftJoin(category, eq(equipment.categoryId, category.id))
        .where(whereClause)
        .groupBy(booking.id)
        .orderBy(bookingOrder(data.sortBy, data.sortOrder))
        .limit(data.limit)
        .offset((data.page - 1) * data.limit),
    ])

    const withItems = await attachItems(database, pageBookings)

    return {
      data: withItems.map((b, i) => ({
        ...b,
        user: pageBookings[i].user ?? null,
      })) as AdminBookingWithDetails[],
      pagination: buildPageInfo(total, data.page, data.limit),
    }
  })

/**
 * Get booking details by ID for admin oversight
 * Includes user and equipment details for administrative management
 */
export const getAdminBookingByIdFn = createServerFn({ method: 'GET' })
  .validator(GetBookingByIdSchema)
  .handler(async ({ data }): Promise<AdminBookingWithDetails | null> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { booking, user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { attachItems } = await import('../list-query')

    const { database } = await adminContext(['admin', 'manager'])

    const [parent] = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        userEventDetails: booking.userEventDetails,
        startedAt: booking.startedAt,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          image: user.image,
        },
      })
      .from(booking)
      .leftJoin(user, eq(booking.userId, user.id))
      .where(eq(booking.id, data.bookingId))
      .limit(1)

    if (!parent) return null

    const [result] = await attachItems(database, [parent])
    if (result.items.length === 0) return null

    return { ...result, user: parent.user ?? null } as AdminBookingWithDetails
  })

/**
 * Update booking with admin privileges and Google Calendar integration.
 *
 * Admins may only move a booking to `cancelled` (which deletes the calendar
 * events). Without a status, this updates the booked schedule/notes. Other
 * statuses are set automatically by the system and are rejected here.
 */
export const updateBookingStatusAdminFn = createServerFn({ method: 'POST' })
  .validator(UpdateBookingStatusAdminSchema)
  .handler(async ({ data }) => {
    const { adminContext } = await import('@/lib/admin/server')
    const { buildCalendarEvent, equipmentLabel } =
      await import('../calendar-events')
    const {
      deleteCalendarEventRaw,
      updateCalendarEventRaw,
      checkCalendarFreeBusyRaw,
    } = await import('@/lib/google/google-calendar-client')
    const { booking, bookingItem, equipment, user } =
      await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { recomputeBookingStatus } = await import('../status')

    const { admin: adminUser, database } = await adminContext([
      'admin',
      'manager',
    ])
    const adminDisplayName = formatUserDisplayName({
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      name: adminUser.name || adminUser.email,
      telegramUsername: adminUser.telegramUsername,
    })

    // Admins may only change a booking's status to `cancelled`. Other statuses
    // are derived automatically (start/overdue/return) and are rejected here.
    if (data.status && data.status !== 'cancelled') {
      throw new UserError(
        'Admins can only change a booking status to "cancelled". Other statuses are set automatically.'
      )
    }

    // Get the booking with user details
    const bookingDataResult = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        startedAt: booking.startedAt,
        userEventDetails: booking.userEventDetails,
        user: {
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

    const bookingData = bookingDataResult[0]

    if (!bookingData) {
      throw new UserError('Booking not found')
    }

    // Responsibility chain: a booking can only be cancelled before it has
    // started. Once equipment is checked out (active/overdue/partially
    // returned), it must be returned through the Telegram bot instead.
    if (data.status === 'cancelled' && bookingData.status !== 'booked') {
      throw new UserError(
        'Only upcoming bookings can be cancelled. This booking has already started and must be returned through the Telegram bot.'
      )
    }

    const previousStatus = bookingData.status
    const newStartTime = data.startTime || bookingData.startTime.toISOString()
    const newEndTime = data.endTime || bookingData.endTime.toISOString()

    const timesChanged = Boolean(data.startTime || data.endTime)

    // Load items with equipment calendars
    const items = await database
      .select({
        id: bookingItem.id,
        status: bookingItem.status,
        googleCalendarEventId: bookingItem.googleCalendarEventId,
        equipmentCalendarId: equipment.googleCalendarId,
        equipmentId: equipment.id,
        equipmentModelName: equipment.modelName,
      })
      .from(bookingItem)
      .leftJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
      .where(eq(bookingItem.bookingId, data.bookingId))

    if (items.length === 0) {
      throw new UserError('Booking has no items')
    }

    // If times are changing, check availability on all item calendars
    if (timesChanged) {
      for (const item of items) {
        if (!item.equipmentCalendarId) continue
        const freeBusyResult = await checkCalendarFreeBusyRaw({
          calendarId: item.equipmentCalendarId,
          timeMin: newStartTime,
          timeMax: newEndTime,
        })

        // The booking's own events still occupy the calendar until they are
        // moved below, so exclude them before reporting conflicts. Without
        // this, rescheduling to an overlapping time fails with a false
        // "Requested time conflicts with existing booking" error.
        const { excludeOwnBookingPeriod } = await import('../availability')
        const conflicts = excludeOwnBookingPeriod(
          freeBusyResult.busy,
          bookingData.startedAt ?? bookingData.startTime,
          bookingData.endTime
        )

        if (conflicts.length > 0) {
          const err: Error & { conflict?: (typeof conflicts)[number] } =
            new Error(
              `Requested time conflicts with existing booking for ${item.equipmentModelName || `equipment ${item.equipmentId}`}`
            )
          err.conflict = conflicts[0]
          throw err
        }
      }
    }

    // Update booking notes; only adjust times when the admin explicitly rebooks
    // the schedule (cancelling never changes the booked times). When cancelling,
    // keep the user's notes and append the admin reason; otherwise the admin
    // edits the whole user_event_details, just like the user does.
    const updatedNotes =
      data.status === 'cancelled'
        ? data.notes
          ? `${bookingData.userEventDetails || ''}\n\n[Admin Note by ${adminDisplayName}]: ${data.notes}`.trim()
          : bookingData.userEventDetails
        : data.notes !== undefined
          ? data.notes.trim() || null
          : bookingData.userEventDetails

    await database
      .update(booking)
      .set({
        userEventDetails: updatedNotes,
        ...(timesChanged
          ? { startTime: new Date(newStartTime), endTime: new Date(newEndTime) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(booking.id, data.bookingId))

    // Handle Google Calendar integration
    const userDisplayName = formatUserDisplayName({
      firstName: bookingData.user?.firstName,
      lastName: bookingData.user?.lastName,
      name: bookingData.user?.name,
      telegramUsername: bookingData.user?.telegramUsername,
    })

    if (data.status === 'cancelled') {
      // Cancel: mark all items cancelled, recompute parent, delete events.
      await database
        .update(bookingItem)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(bookingItem.bookingId, data.bookingId))

      // A failure here must not stop the calendar event cleanup below,
      // otherwise the equipment stays busy after the booking was cancelled.
      try {
        await recomputeBookingStatus(database, data.bookingId)
      } catch (err) {
        console.error('Failed to recompute booking status on cancel:', err)
      }

      try {
        await logBookingActivityById(data.bookingId, 'cancelled', {
          actorName: adminDisplayName,
          reason: data.notes || undefined,
        })
      } catch (logError) {
        console.error('Failed to log booking cancellation:', logError)
      }

      for (const item of items) {
        if (!item.googleCalendarEventId || !item.equipmentCalendarId) continue
        try {
          await deleteCalendarEventRaw({
            equipmentCalendarId: item.equipmentCalendarId,
            eventId: item.googleCalendarEventId,
          })
        } catch (calendarError) {
          console.error('Failed to delete calendar event:', calendarError)
        }
      }

      return { success: true, previousStatus, newStatus: 'cancelled' }
    }

    // Times / notes update only (status is unchanged)
    await recomputeBookingStatus(database, data.bookingId)

    try {
      await logBookingActivityById(data.bookingId, 'edited', {
        actorName: adminDisplayName,
        previous: {
          startTime: bookingData.startTime,
          endTime: bookingData.endTime,
          eventDetails: bookingData.userEventDetails,
        },
      })
    } catch (logError) {
      console.error('Failed to log booking update:', logError)
    }

    for (const item of items) {
      if (!item.googleCalendarEventId || !item.equipmentCalendarId) continue

      const label = equipmentLabel(item.equipmentModelName, item.equipmentId)
      const event = buildCalendarEvent({
        summary: `${label} - Booking (${previousStatus.toUpperCase()})`,
        description: formatBookingDetailsPlain({
          bookingId: data.bookingId,
          userDisplayName,
          equipmentNames: [label],
          startTime: newStartTime,
          endTime: newEndTime,
          startedAt: bookingData.startedAt,
          status: previousStatus,
          notes: updatedNotes,
        }),
        start: newStartTime,
        end: newEndTime,
      })

      try {
        await updateCalendarEventRaw({
          equipmentCalendarId: item.equipmentCalendarId,
          eventId: item.googleCalendarEventId,
          event,
        })
      } catch (calendarError) {
        console.error('Failed to update calendar event:', calendarError)
      }
    }

    return { success: true, previousStatus, newStatus: previousStatus }
  })
