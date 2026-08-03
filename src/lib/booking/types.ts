import { z } from 'zod'

export interface BookingWithEquipment {
  id: number
  userId: string
  equipmentId: number
  startTime: Date
  endTime: Date
  status: string
  googleCalendarEventId: string | null
  userEventDetails: string | null
  createdAt: Date
  updatedAt: Date
  equipment: {
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
  } | null
}

export interface AdminBookingWithDetails {
  id: number
  userId: string
  equipmentId: number
  startTime: Date
  endTime: Date
  status: string
  googleCalendarEventId: string | null
  userEventDetails: string | null
  createdAt: Date
  updatedAt: Date
  equipment: {
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
  } | null
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  } | null
}

export const BookingInputSchema = z.object({
  equipmentId: z.coerce.number(),
  startTime: z.string(),
  endTime: z.string(),
  notes: z.string().optional(),
})

export const MultiBookingInputSchema = z.object({
  equipmentIds: z.array(z.coerce.number()).min(1),
  startTime: z.string(),
  endTime: z.string(),
  notes: z.string().optional(),
})

export const BookingFiltersSchema = z.object({
  status: z.array(z.enum(['booked', 'active', 'returned', 'cancelled', 'overdue'])).optional(),
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
  data: BookingWithEquipment[]
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
  status: z.array(z.enum(['booked', 'active', 'returned', 'cancelled', 'overdue'])).optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  sortBy: z.enum(['startTime', 'endTime', 'status', 'createdAt', 'equipment', 'user']).optional().default('startTime'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

export type AdminBookingFilters = z.infer<typeof AdminBookingFiltersSchema>

export const UpdateBookingStatusAdminSchema = z.object({
  bookingId: z.coerce.number(),
  status: z.enum(['booked', 'active', 'returned', 'cancelled', 'overdue']),
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

export const BulkUpdateBookingTimeSchema = z.object({
  bookingIds: z.array(z.coerce.number()).min(1),
  startTime: z.string(),
  endTime: z.string(),
})

export const BulkUpdateBookingTimeAdminSchema = z.object({
  bookingIds: z.array(z.coerce.number()).min(1),
  startTime: z.string(),
  endTime: z.string(),
})

export const CancelBookingSchema = z.object({
  bookingId: z.coerce.number()
})

export const GetBookingByIdSchema = z.object({
  bookingId: z.coerce.number()
})

export const DeleteBookingSchema = z.object({
  bookingId: z.coerce.number()
})

