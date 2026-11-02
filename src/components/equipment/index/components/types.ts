import type { EquipmentWithCategory } from '@/lib/equipment/types'

export type Equipment = EquipmentWithCategory

export type Category = NonNullable<EquipmentWithCategory['category']>

export type EquipmentAvailabilityStatus =
  'in-booking' | 'checking' | 'unavailable' | 'available'
