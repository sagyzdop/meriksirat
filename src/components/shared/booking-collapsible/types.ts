import type { BookingItemWithEquipment } from '@/lib/booking/types'

export interface BookingCollapsibleRowData {
  id: number
  startTime: Date
  endTime: Date
  status: string
  createdAt: Date
  userEventDetails: string | null
  items: BookingItemWithEquipment[]
  user?: {
    email: string
    firstName: string | null
    lastName: string | null
  } | null
}

export interface BookingCollapsiblePagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface BookingCollapsibleFilters {
  status?: string[]
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export interface BookingStatusOption {
  value: string
  label: string
}
