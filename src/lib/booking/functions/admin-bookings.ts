import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type {
  PaginatedAdminBookingsResponse,
  AdminBookingWithDetails,
} from '../types'
import {
  AdminBookingFiltersSchema,
  UpdateBookingStatusAdminSchema,
  GetBookingByIdSchema,
  DeleteBookingSchema,
} from '../types'
import type { BookingItemRow } from '../mappers'
import { mapBookingsWithItems, itemSelect } from '../mappers'
import { buildEventDescription, formatUserDisplayName } from '@/lib/utils'

/**
 * Get all bookings with comprehensive filtering and pagination for admin oversight
 * Includes user and equipment details for administrative management
 */
export const getAdminBookingsFn = createServerFn({ method: 'GET' })
  .validator(AdminBookingFiltersSchema)
  .handler(async ({ data }): Promise<PaginatedAdminBookingsResponse> => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, bookingItem, equipment, user, category } = await import('@/db/schema')
    const { eq, and, sql, desc, asc, inArray } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Build where conditions
    const conditions = []

    if (data.status && data.status.length > 0) {
      conditions.push(inArray(booking.status, data.status))
    }

    const whereClause = conditions.length === 0 ? undefined :
      conditions.length === 1 ? conditions[0] : and(...conditions)

    const offset = (data.page - 1) * data.limit

    const order = (() => {
      const dir = data.sortOrder === 'desc' ? desc : asc
      switch (data.sortBy) {
        case 'startTime': return dir(booking.startTime)
        case 'endTime': return dir(booking.endTime)
        case 'status': return dir(booking.status)
        case 'createdAt': return dir(booking.createdAt)
        case 'equipment': return dir(sql`min(${equipment.modelName})`)
        case 'user': return dir(user.email)
        default: return dir(booking.startTime)
      }
    })()

    const countQuery = database
      .select({ count: sql<number>`count(distinct ${booking.id})` })
      .from(booking)
      .leftJoin(bookingItem, eq(bookingItem.bookingId, booking.id))
      .where(whereClause)

    // Main data query (parent bookings + user info)
    const bookingsQuery = database
      .select({
        id: booking.id,
        userId: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        userEventDetails: booking.userEventDetails,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      })
      .from(booking)
      .leftJoin(user, eq(booking.userId, user.id))
      .leftJoin(bookingItem, eq(bookingItem.bookingId, booking.id))
      .leftJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
      .leftJoin(category, eq(equipment.categoryId, category.id))
      .where(whereClause)
      .groupBy(booking.id)
      .orderBy(order)
      .limit(data.limit)
      .offset(offset)

    const [totalCountResult, pageBookings] = await Promise.all([
      countQuery,
      bookingsQuery
    ])

    const total = totalCountResult[0]?.count || 0
    const totalPages = Math.ceil(total / data.limit)

    const pageBookingIds = pageBookings.map((b) => b.id)

    // Fetch full item rows for the current page
    let flatRows: BookingItemRow[] = []
    if (pageBookingIds.length > 0) {
      const itemRows = await database
        .select({ bookingId: bookingItem.bookingId, ...itemSelect(bookingItem, equipment, category) })
        .from(bookingItem)
        .leftJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
        .leftJoin(category, eq(equipment.categoryId, category.id))
        .where(inArray(bookingItem.bookingId, pageBookingIds))
        .orderBy(bookingItem.id)

      const itemsByBooking = new Map<number, (typeof itemRows)[number][]>()
      for (const row of itemRows) {
        const list = itemsByBooking.get(row.bookingId) ?? []
        list.push(row)
        itemsByBooking.set(row.bookingId, list)
      }

      flatRows = pageBookings.flatMap((b) => {
        const items = itemsByBooking.get(b.id) ?? []
        if (items.length === 0) {
          return [{
            bookingId: b.id,
            userId: b.userId,
            startTime: b.startTime,
            endTime: b.endTime,
            status: b.status,
            userEventDetails: b.userEventDetails,
            createdAt: b.createdAt,
            updatedAt: b.updatedAt,
            itemId: 0,
            equipmentId: 0,
            itemStatus: 'cancelled',
            gcalEventId: null,
            returnedAt: null,
            itemCreatedAt: b.createdAt,
            itemUpdatedAt: b.updatedAt,
            eqId: null,
            eqModelName: null,
            eqDescription: null,
            eqCategoryId: null,
            eqImagePath: null,
            eqGcalId: null,
            catId: null,
            catName: null,
          } as BookingItemRow]
        }
        return items.map((it) => ({
          bookingId: b.id,
          userId: b.userId,
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status,
          userEventDetails: b.userEventDetails,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
          itemId: it.itemId,
          equipmentId: it.equipmentId,
          itemStatus: it.itemStatus,
          gcalEventId: it.gcalEventId,
          returnedAt: it.returnedAt,
          itemCreatedAt: it.itemCreatedAt,
          itemUpdatedAt: it.itemUpdatedAt,
          eqId: it.eqId,
          eqModelName: it.eqModelName,
          eqDescription: it.eqDescription,
          eqCategoryId: it.eqCategoryId,
          eqImagePath: it.eqImagePath,
          eqGcalId: it.eqGcalId,
          catId: it.catId,
          catName: it.catName,
        }))
      })
    }

    const dataWithItems = mapBookingsWithItems(flatRows)

    const response: PaginatedAdminBookingsResponse = {
      data: dataWithItems.map((b) => {
        const parent = pageBookings.find((p) => p.id === b.id)
        return {
          ...b,
          user: parent?.user ?? null,
        }
      }) as AdminBookingWithDetails[],
      pagination: {
        page: data.page,
        limit: data.limit,
        total,
        totalPages,
        hasNext: data.page < totalPages,
        hasPrev: data.page > 1,
      }
    }

    return response
  })

/**
 * Get booking details by ID for admin oversight
 * Includes user and equipment details for administrative management
 */
export const getAdminBookingByIdFn = createServerFn({ method: 'GET' })
  .validator(GetBookingByIdSchema)
  .handler(async ({ data }): Promise<AdminBookingWithDetails | null> => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, bookingItem, equipment, user, category } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    const parentRow = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        userEventDetails: booking.userEventDetails,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      })
      .from(booking)
      .leftJoin(user, eq(booking.userId, user.id))
      .where(eq(booking.id, data.bookingId))
      .limit(1)

    const parent = parentRow[0]
    if (!parent) return null

    const itemRows = await database
      .select({ bookingId: bookingItem.bookingId, ...itemSelect(bookingItem, equipment, category) })
      .from(bookingItem)
      .leftJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
      .leftJoin(category, eq(equipment.categoryId, category.id))
      .where(eq(bookingItem.bookingId, parent.id))
      .orderBy(bookingItem.id)

    const flatRows: BookingItemRow[] = itemRows.map((it) => ({
      bookingId: parent.id,
      userId: parent.userId,
      startTime: parent.startTime,
      endTime: parent.endTime,
      status: parent.status,
      userEventDetails: parent.userEventDetails,
      createdAt: parent.createdAt,
      updatedAt: parent.updatedAt,
      itemId: it.itemId,
      equipmentId: it.equipmentId,
      itemStatus: it.itemStatus,
      gcalEventId: it.gcalEventId,
      returnedAt: it.returnedAt,
      itemCreatedAt: it.itemCreatedAt,
      itemUpdatedAt: it.itemUpdatedAt,
      eqId: it.eqId,
      eqModelName: it.eqModelName,
      eqDescription: it.eqDescription,
      eqCategoryId: it.eqCategoryId,
      eqImagePath: it.eqImagePath,
      eqGcalId: it.eqGcalId,
      catId: it.catId,
      catName: it.catName,
    }))

    const mapped = mapBookingsWithItems(flatRows)[0]
    if (!mapped) return null

    return {
      ...mapped,
      user: parent.user ?? null,
    } as AdminBookingWithDetails
  })

/**
 * Update booking status with admin privileges and Google Calendar integration
 * Includes administrative notes capability and calendar synchronization
 * Applies to the whole booking (all items).
 */
export const updateBookingStatusAdminFn = createServerFn({ method: 'POST' })
  .validator(UpdateBookingStatusAdminSchema)
  .handler(async ({ data }) => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { deleteCalendarEvent, updateCalendarEvent, checkCalendarFreeBusy } = await import('@/lib/google/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, bookingItem, equipment, user } = await import('@/db/schema')
    const { eq, and, inArray } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')
    const { recomputeBookingStatus } = await import('../status')

    const headers = getRequestHeaders()
    const adminUser = await checkAdminPermission(headers, ['admin', 'manager'])
    const adminDisplayName = formatUserDisplayName({
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      name: adminUser.name || adminUser.email,
      telegramUsername: adminUser.telegramUsername
    })

    const database = db(env.meriksirat_d1 as D1Database)

    // Get the booking with user details
    const bookingDataResult = await database
      .select({
        id: booking.id,
        userId: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        userEventDetails: booking.userEventDetails,
        user: {
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

    const bookingData = bookingDataResult[0]

    if (!bookingData) {
      throw new Error('Booking not found')
    }

    const previousStatus = bookingData.status
    const newStartTime = data.startTime || bookingData.startTime.toISOString()
    const newEndTime = data.endTime || bookingData.endTime.toISOString()

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
      throw new Error('Booking has no items')
    }

    // If times are changing, check availability on all item calendars
    if (data.startTime || data.endTime) {
      for (const item of items) {
        if (!item.equipmentCalendarId) continue
        const freeBusyResult = await checkCalendarFreeBusy({
          data: {
            calendarId: item.equipmentCalendarId,
            timeMin: newStartTime,
            timeMax: newEndTime,
          }
        })

        if (freeBusyResult.busy.length > 0) {
          const err: any = new Error(`Requested time conflicts with existing booking for ${item.equipmentModelName || `equipment ${item.equipmentId}`}`)
          err.conflict = freeBusyResult.busy[0]
          throw err
        }
      }
    }

    // Update booking notes and times
    const updatedNotes = data.notes
      ? `${bookingData.userEventDetails || ''}\n\n[Admin Note by ${adminDisplayName}]: ${data.notes}`.trim()
      : bookingData.userEventDetails

    await database
      .update(booking)
      .set({
        userEventDetails: updatedNotes,
        startTime: new Date(newStartTime),
        endTime: new Date(newEndTime),
        updatedAt: new Date(),
      })
      .where(eq(booking.id, data.bookingId))

    // Determine which items to apply the status change to
    // - cancelled/returned apply to all non-terminal items
    // - active/booked/overdue apply to items that are not returned/cancelled
    const changedItems = items.filter((item) => {
      if (item.status === 'cancelled' || item.status === 'returned') return false
      return true
    })

    if (data.status === 'cancelled' || data.status === 'returned') {
      const terminalStatus = data.status === 'cancelled' ? 'cancelled' : 'returned'
      await database
        .update(bookingItem)
        .set({
          status: terminalStatus,
          returnedAt: terminalStatus === 'returned' ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(bookingItem.bookingId, data.bookingId))
    } else if (changedItems.length > 0) {
      await database
        .update(bookingItem)
        .set({ status: data.status, updatedAt: new Date() })
        .where(and(eq(bookingItem.bookingId, data.bookingId), inArray(bookingItem.id, changedItems.map((i) => i.id))))
    }

    // Recompute parent status
    await recomputeBookingStatus(database, data.bookingId)

    // Log booking status change to Telegram channel
    try {
      await logBookingActivityById(data.bookingId, 'updated', {
        previousStatus,
        newStatus: data.status,
        notes: `Admin ${adminDisplayName} changed status from ${previousStatus} to ${data.status}${data.notes ? `. Notes: ${data.notes}` : ''}`
      })
    } catch (logError) {
      console.error('Failed to log booking status update:', logError)
    }

    // Handle Google Calendar integration
    const { settings } = await import('@/db/schema')
    const settingsData = await database
      .select({ globalBookingNote: settings.globalBookingNote })
      .from(settings)
      .where(eq(settings.id, 'global'))
      .get()

    const globalNote = settingsData?.globalBookingNote
    const userDisplayName = formatUserDisplayName({
      firstName: bookingData.user?.firstName,
      lastName: bookingData.user?.lastName,
      name: bookingData.user?.name,
      telegramUsername: bookingData.user?.telegramUsername
    })

    for (const item of items) {
      if (!item.googleCalendarEventId || !item.equipmentCalendarId) continue

      if (data.status === 'cancelled') {
        try {
          await deleteCalendarEvent({
            data: {
              equipmentCalendarId: item.equipmentCalendarId,
              eventId: item.googleCalendarEventId,
            }
          })
        } catch (calendarError) {
          console.error('Failed to delete calendar event:', calendarError)
        }
        continue
      }

      const description = buildEventDescription({
        bookingId: data.bookingId,
        userDisplayName,
        status: data.status,
        notes: updatedNotes,
        globalNote
      })

      const event = {
        summary: `${item.equipmentModelName || `Equipment ${item.equipmentId}`} - Booking (${data.status.toUpperCase()})`,
        description,
        start: { dateTime: newStartTime, timeZone: 'UTC' },
        end: { dateTime: newEndTime, timeZone: 'UTC' },
      }

      try {
        await updateCalendarEvent({
          data: {
            equipmentCalendarId: item.equipmentCalendarId,
            eventId: item.googleCalendarEventId,
            event,
            userEmail: bookingData.user?.email || '',
          }
        })
      } catch (calendarError) {
        console.error('Failed to update calendar event:', calendarError)
      }
    }

    return { success: true, previousStatus, newStatus: data.status }
  })

/**
 * Delete booking permanently with admin privileges
 * Also handles Google Calendar event deletion for all items
 */
export const deleteBookingAdminFn = createServerFn({ method: 'POST' })
  .validator(DeleteBookingSchema)
  .handler(async ({ data }) => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { deleteCalendarEvent } = await import('@/lib/google/google-caledar')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db/index')
    const { booking, bookingItem, equipment } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const { logBookingActivityById } = await import('@/lib/telegram/logging')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    // Get the booking's items with equipment details for calendar deletion
    const items = await database
      .select({
        googleCalendarEventId: bookingItem.googleCalendarEventId,
        equipmentCalendarId: equipment.googleCalendarId,
      })
      .from(bookingItem)
      .leftJoin(equipment, eq(bookingItem.equipmentId, equipment.id))
      .where(eq(bookingItem.bookingId, data.bookingId))

    const bookingExists = await database
      .select({ id: booking.id })
      .from(booking)
      .where(eq(booking.id, data.bookingId))
      .limit(1)

    if (bookingExists.length === 0) {
      throw new Error('Booking not found')
    }

    // Delete calendar events if they exist
    for (const item of items) {
      if (item.googleCalendarEventId && item.equipmentCalendarId) {
        try {
          await deleteCalendarEvent({
            data: {
              equipmentCalendarId: item.equipmentCalendarId,
              eventId: item.googleCalendarEventId,
            }
          })
        } catch (calendarError) {
          console.error('Failed to delete calendar event during booking deletion:', calendarError)
        }
      }
    }

    // Log booking deletion to Telegram channel before deleting record
    try {
      await logBookingActivityById(data.bookingId, 'deleted', {
        notes: 'Booking permanently deleted by administrator'
      })
    } catch (logError) {
      console.error('Failed to log booking deletion:', logError)
    }

    // Delete booking record from database (booking_item rows cascade)
    await database
      .delete(booking)
      .where(eq(booking.id, data.bookingId))

    return { success: true }
  })

