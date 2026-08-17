import { formatUserDisplayName } from '@/lib/utils'

/**
 * Shared booking details formatter.
 *
 * Produces the same structured "Label: Value" fields used for both Google
 * Calendar event descriptions (plain text) and Telegram log messages (HTML),
 * so the calendar event details always match what is posted to the channel.
 *
 * This module is client-safe (no server-only imports).
 */

export interface BookingDetailInput {
  bookingId: number
  userDisplayName?: string
  user?: {
    firstName?: string | null
    lastName?: string | null
    name?: string | null
    telegramUsername?: string | null
  } | null
  equipmentNames?: string[]
  startTime?: Date | string | number | null
  endTime?: Date | string | number | null
  startedAt?: Date | string | number | null
  returnedAt?: Date | string | number | null
  status?: string | null
  notes?: string | null
}

/**
 * Club timezone (UTC+5). Used for all rendered booking timestamps so calendar
 * event descriptions and channel logs show the club's local time.
 */
const CLUB_TIMEZONE = 'Asia/Karachi'

export function formatBookingTimestamp(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: CLUB_TIMEZONE,
  })
}

function formatEquipmentLabel(equipmentNames?: string[]): string {
  if (!equipmentNames || equipmentNames.length === 0) return '—'
  if (equipmentNames.length === 1) return equipmentNames[0]
  return `${equipmentNames.length} items: ${equipmentNames.join(', ')}`
}

export function buildBookingDetailFields(
  input: BookingDetailInput
): Array<{ label: string; value: string }> {
  const fields: Array<{ label: string; value: string }> = []

  const user = formatUserDisplayName(
    input.user ?? { name: input.userDisplayName ?? 'Unknown user' }
  )
  const equipmentLabel = formatEquipmentLabel(input.equipmentNames)

  fields.push({ label: 'Booking ID', value: `#${input.bookingId}` })
  fields.push({ label: 'User', value: user })
  fields.push({ label: 'Equipment', value: equipmentLabel })

  if (input.startTime && input.endTime) {
    fields.push({
      label: 'Booked time',
      value: `${formatBookingTimestamp(input.startTime)} – ${formatBookingTimestamp(input.endTime)}`,
    })
  }

  if (input.startedAt) {
    fields.push({
      label: 'Actual start',
      value: formatBookingTimestamp(input.startedAt),
    })
  }

  if (input.returnedAt) {
    fields.push({
      label: 'Actual return',
      value: formatBookingTimestamp(input.returnedAt),
    })
  }

  fields.push({
    label: 'Status',
    value: input.status ? input.status.toUpperCase() : '—',
  })
  fields.push({
    label: 'Notes',
    value: input.notes?.trim() || 'No additional notes',
  })

  return fields
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Plain-text rendering for Google Calendar event descriptions.
 */
export function formatBookingDetailsPlain(input: BookingDetailInput): string {
  const lines = buildBookingDetailFields(input).map(
    (field) => `${field.label}: ${field.value}`
  )
  return lines.join('\n')
}

/**
 * HTML rendering for Telegram log messages and bot confirmations.
 */
export function formatBookingDetailsHtml(input: BookingDetailInput): string {
  const lines = buildBookingDetailFields(input).map(
    (field) => `<b>${escapeHtml(field.label)}:</b> ${escapeHtml(field.value)}`
  )
  return lines.join('\n')
}
