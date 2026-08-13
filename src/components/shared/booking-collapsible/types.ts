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
  startDate?: string
  endDate?: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export interface BookingCollapsiblePersonInfo {
  name: string
  image?: string | null
  href?: string
}

export interface BookingStatusOption {
  value: string
  label: string
}
