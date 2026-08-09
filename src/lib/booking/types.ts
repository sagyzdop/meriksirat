import { z } from 'zod'

export interface BookingEquipmentInfo {
  id: number
  modelName: string
  description: string | null
  categoryId: number | null
  imagePath: string | null
  googleCalendarId: string
  category: {
    id: number
    name: string
  } | null
}

export interface BookingItemWithEquipment {
  id: number
  equipmentId: number
  status: string
  googleCalendarEventId: string | null
  returnedAt: Date | null
  createdAt: Date
  updatedAt: Date
  equipment: BookingEquipmentInfo | null
}

export interface BookingWithItems {
  id: number
  userId: string
  startTime: Date
  endTime: Date
  status: string
  userEventDetails: string | null
  createdAt: Date
  updatedAt: Date
  items: BookingItemWithEquipment[]
}

export interface AdminBookingWithDetails extends BookingWithItems {
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  } | null
}

export const BOOKING_STATUSES = ['booked', 'active', 'returned', 'cancelled', 'overdue', 'partially_returned'] as const
export const SETTABLE_BOOKING_STATUSES = ['booked', 'active', 'returned', 'cancelled', 'overdue'] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]
export type SettableBookingStatus = (typeof SETTABLE_BOOKING_STATUSES)[number]

export const CreateBookingSchema = z.object({
  equipmentIds: z.array(z.coerce.number()).min(1),
  startTime: z.string(),
  endTime: z.string(),
  notes: z.string().optional(),
})

export const BookingFiltersSchema = z.object({
  status: z.array(z.enum(BOOKING_STATUSES)).optional(),
  equipmentId: z.coerce.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  sortBy: z.enum(['startTime', 'endTime', 'status', 'createdAt', 'equipment']).optional().default('startTime'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

export type BookingFilters = z.infer<typeof BookingFiltersSchema>

export interface PaginatedBookingsResponse {
  data: BookingWithItems[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface PaginatedAdminBookingsResponse {
  data: AdminBookingWithDetails[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Admin booking oversight schemas
export const AdminBookingFiltersSchema = z.object({
  status: z.array(z.enum(BOOKING_STATUSES)).optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  sortBy: z.enum(['startTime', 'endTime', 'status', 'createdAt', 'equipment', 'user']).optional().default('startTime'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

export type AdminBookingFilters = z.infer<typeof AdminBookingFiltersSchema>

export const UpdateBookingStatusAdminSchema = z.object({
  bookingId: z.coerce.number(),
  status: z.enum(SETTABLE_BOOKING_STATUSES),
  notes: z.string().optional(), // Admin notes will be stored in userEventDetails for now
  startTime: z.string().optional(),
  endTime: z.string().optional(),
})

export const UpdateBookingSchema = z.object({
  bookingId: z.coerce.number(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  notes: z.string().optional(),
})

export const CancelBookingSchema = z.object({
  bookingId: z.coerce.number()
})

export const CancelBookingItemSchema = z.object({
  bookingId: z.coerce.number(),
  itemId: z.coerce.number(),
})

export const GetBookingByIdSchema = z.object({
  bookingId: z.coerce.number()
})

export const DeleteBookingSchema = z.object({
  bookingId: z.coerce.number()
})
