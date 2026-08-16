import { EquipmentAvailabilityStatus } from './types'

export const availabilityBadgeClass: Record<
  EquipmentAvailabilityStatus,
  string
> = {
  'in-booking': 'bg-slate-100 text-slate-700',
  checking: 'bg-amber-100 text-amber-700',
  unavailable: 'bg-red-100 text-red-700',
  available: 'bg-green-100 text-green-800',
}

export const availabilityBadgeLabel: Record<
  EquipmentAvailabilityStatus,
  string
> = {
  'in-booking': 'In booking',
  checking: 'Checking…',
  unavailable: 'Unavailable',
  available: 'Available',
}

/**
 * Computes the availability status shown on the equipment card and the
 * equipment detail page so both stay in sync.
 *
 * - `in-booking`: already attached to the current booking (add-to-booking mode)
 * - `unavailable`: equipment is disabled or has no calendar events in the window
 * - `checking`: the free/busy check is still in flight
 * - `available`: no conflicting calendar events in the window
 */
export function getEquipmentAvailabilityStatus(opts: {
  isDisabled?: boolean
  isActive: boolean | null | undefined
  isChecking: boolean
  isBusy: boolean
}): EquipmentAvailabilityStatus {
  if (opts.isDisabled) return 'in-booking'
  if (opts.isActive === false) return 'unavailable'
  if (opts.isChecking) return 'checking'
  return opts.isBusy ? 'unavailable' : 'available'
}
