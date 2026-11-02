export function itemBelongsToBooking(
  itemBookingId: number | null | undefined,
  bookingId: number
): boolean {
  return itemBookingId != null && itemBookingId === bookingId
}

export function ownsBooking(
  bookingOwnerId: string | null | undefined,
  actorId: string | null | undefined
): boolean {
  return !!bookingOwnerId && !!actorId && bookingOwnerId === actorId
}
