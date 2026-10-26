/**
 * Telegram channel log formatting
 *
 * Pure formatters for the admin channel logs. Messages are Telegram HTML, so
 * every user-provided value goes through `escapeHtml`. Kept free of worker
 * imports so it can be unit tested.
 */

const CLUB_TIMEZONE = 'Asia/Almaty'
const MAX_TEXT_LENGTH = 200
export const MAX_CAPTION_LENGTH = 1024

const BOOKING_EVENTS = {
  booked: '🆕 Booked',
  picked_up: '▶️ Picked up',
  extended: '⏩ Extended',
  items_added: '➕ Items added',
  edited: '✏️ Edited',
  overdue: '⚠️ Overdue',
  cancelled: '❌ Cancelled',
  auto_cancelled: '⏱ Auto-cancelled (no pickup)',
  returned: '✅ Returned',
  deleted: '🗑 Deleted',
} as const

export type BookingLogEvent = keyof typeof BOOKING_EVENTS

const SYSTEM_EVENTS: ReadonlySet<BookingLogEvent> = new Set([
  'overdue',
  'auto_cancelled',
])

const ALBUM_ACTIONS = {
  created: '🆕 Album created',
  updated: '✏️ Album edited',
  deleted: '🗑 Album deleted',
  shared: '🔓 Album shared',
  unshared: '🔐 Album unshared',
  photo_deleted: '🗑 Photo deleted',
  member_added: '➕ Editor joined',
  member_removed: '➖ Editor removed',
  token_rotated: '🔄 Share link reset',
} as const

export type AlbumLogAction = keyof typeof ALBUM_ACTIONS

export interface BookingLogData {
  bookingId: number
  event: BookingLogEvent
  userName: string
  // Admin who performed the action. Omitted when the booking's own member
  // acted, or for system events; the member is then named in the header.
  actorName?: string
  equipmentNames: string[]
  // Per-item statuses, aligned with equipmentNames. Used to tell whole-booking
  // cancellations/returns from partial ones.
  itemStatuses?: string[]
  startTime: Date
  endTime: Date
  startedAt?: Date | null
  eventDetails?: string | null
  // Booking state before an edit; only changed fields are rendered.
  previous?: {
    startTime: Date
    endTime: Date
    eventDetails?: string | null
  }
  addedItems?: string[]
  extendedMinutes?: number
  overdueCleared?: boolean
  reason?: string
  url?: string
  now?: Date
}

export interface AlbumLogData {
  albumId: string
  albumTitle: string
  action: AlbumLogAction
  actorName?: string | null
  details?: string[]
  url?: string
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Collapses whitespace and caps free text so one long note can't bloat a log.
 */
function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > MAX_TEXT_LENGTH
    ? `${flat.slice(0, MAX_TEXT_LENGTH - 1).trimEnd()}…`
    : flat
}

function zonedYear(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    timeZone: CLUB_TIMEZONE,
  }).format(date)
}

function formatDay(date: Date, now: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(zonedYear(date) !== zonedYear(now) ? { year: 'numeric' } : {}),
    timeZone: CLUB_TIMEZONE,
  }).format(date)
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: CLUB_TIMEZONE,
  }).format(date)
}

/**
 * "Oct 27, 14:00–16:00", or with both days when the range crosses midnight.
 */
function formatRange(start: Date, end: Date, now: Date): string {
  const startDay = formatDay(start, now)
  const endDay = formatDay(end, now)
  return startDay === endDay
    ? `${startDay}, ${formatTime(start)}–${formatTime(end)}`
    : `${startDay}, ${formatTime(start)} – ${endDay}, ${formatTime(end)}`
}

function formatRangeChange(
  previous: { startTime: Date; endTime: Date },
  start: Date,
  end: Date,
  now: Date
): string {
  const day = formatDay(start, now)
  const sameDay = [previous.startTime, previous.endTime, end].every(
    (date) => formatDay(date, now) === day
  )
  return sameDay
    ? `${day}, ${formatTime(previous.startTime)}–${formatTime(previous.endTime)} → ${formatTime(start)}–${formatTime(end)}`
    : `${formatRange(previous.startTime, previous.endTime, now)} → ${formatRange(start, end, now)}`
}

function joinSections(sections: string[][]): string {
  return sections
    .filter((lines) => lines.length > 0)
    .map((lines) => lines.join('\n'))
    .join('\n\n')
}

function linkLine(url: string | undefined): string[] {
  return url ? [`🔗 <a href="${escapeHtml(url)}">Link</a>`] : []
}

/**
 * Items hit by a partial cancel/return, as indexes into equipmentNames. Empty
 * when the action covered the whole booking.
 */
function partialIndexes(data: BookingLogData): number[] {
  if (data.event !== 'cancelled' && data.event !== 'returned') return []
  const statuses = data.itemStatuses ?? []
  if (statuses.length !== data.equipmentNames.length) return []
  const affected = statuses.flatMap((status, i) =>
    status === data.event ? [i] : []
  )
  return affected.length > 0 && affected.length < statuses.length
    ? affected
    : []
}

function actorLabel(data: BookingLogData): string {
  if (data.actorName) return escapeHtml(data.actorName)
  return SYSTEM_EVENTS.has(data.event) ? 'system' : escapeHtml(data.userName)
}

function bookingHeader(data: BookingLogData, partial: number[]): string {
  const count = partial.length
    ? ` ${partial.length} of ${data.equipmentNames.length}`
    : ''
  const minutes =
    data.event === 'extended' && data.extendedMinutes
      ? ` +${data.extendedMinutes} min`
      : ''
  return `${BOOKING_EVENTS[data.event]}${count}${minutes} by ${actorLabel(data)}`
}

function equipmentLines(
  data: BookingLogData,
  partial: number[],
  compact: boolean
): string[] {
  const names = data.equipmentNames
  if (names.length === 0) return []
  if (compact) {
    return [`📷 ${names.length} ${names.length === 1 ? 'item' : 'items'}`]
  }

  if (data.event === 'items_added' && data.addedItems?.length) {
    const existing = [...names]
    for (const added of data.addedItems) {
      const i = existing.indexOf(added)
      if (i !== -1) existing.splice(i, 1)
    }
    return [
      ...(existing.length ? [`📷 ${existing.map(escapeHtml).join(', ')}`] : []),
      `➕ ${data.addedItems.map(escapeHtml).join(', ')}`,
    ]
  }

  const rendered = names.map((name, i) =>
    partial.includes(i) ? `<s>${escapeHtml(name)}</s>` : escapeHtml(name)
  )
  return [`📷 ${rendered.join(', ')}`]
}

function timeLine(data: BookingLogData, now: Date): string {
  const previous = data.previous
  const timesChanged =
    data.event === 'edited' &&
    previous &&
    (previous.startTime.getTime() !== data.startTime.getTime() ||
      previous.endTime.getTime() !== data.endTime.getTime())

  let line = timesChanged
    ? formatRangeChange(previous, data.startTime, data.endTime, now)
    : formatRange(data.startTime, data.endTime, now)

  if (
    data.startedAt &&
    (data.event === 'picked_up' ||
      data.event === 'returned' ||
      data.event === 'overdue')
  ) {
    line += ` (picked up at ${formatTime(data.startedAt)})`
  }
  if (data.event === 'extended' && data.overdueCleared) {
    line += ' (overdue cleared)'
  }
  return `🕑 ${line}`
}

function detailsLine(data: BookingLogData): string[] {
  const current = clip(data.eventDetails ?? '')
  if (data.event !== 'edited' || !data.previous) {
    return current ? [`💬 ${escapeHtml(current)}`] : []
  }

  const before = clip(data.previous.eventDetails ?? '')
  if (before === current) return []
  if (!current) return [`💬 ${escapeHtml(before)} → (removed)`]
  if (!before) return [`💬 ${escapeHtml(current)}`]
  return [`💬 ${escapeHtml(before)} → ${escapeHtml(current)}`]
}

export function formatBookingLog(
  data: BookingLogData,
  options: { compactEquipment?: boolean } = {}
): string {
  const now = data.now ?? new Date()
  const partial = partialIndexes(data)
  const reason = data.reason ? clip(data.reason) : ''

  const ownerActed = actorLabel(data) === escapeHtml(data.userName)

  return joinSections([
    [
      bookingHeader(data, partial),
      ...(ownerActed ? [] : [`👤 ${escapeHtml(data.userName)}`]),
    ],
    [
      ...equipmentLines(data, partial, options.compactEquipment ?? false),
      ...detailsLine(data),
    ],
    [
      timeLine(data, now),
      ...(reason ? [`Reason: ${escapeHtml(reason)}`] : []),
      ...(data.event === 'deleted' ? [] : linkLine(data.url)),
      `#booking${data.bookingId}`,
    ],
  ])
}

export function formatAlbumLog(data: AlbumLogData): string {
  const label = ALBUM_ACTIONS[data.action]
  const actor = data.actorName ? escapeHtml(data.actorName) : ''
  const header =
    data.action === 'member_added'
      ? `${label}${actor ? `: ${actor}` : ''}`
      : `${label}${actor ? ` by ${actor}` : ''}`

  return joinSections([
    [header],
    [`🖼 ${escapeHtml(data.albumTitle)}`],
    [
      ...(data.details ?? []).map((detail) => escapeHtml(clip(detail))),
      ...(data.action === 'deleted' ? [] : linkLine(data.url)),
      `#${data.albumId}`,
    ],
  ])
}

/**
 * Length Telegram counts for a caption: visible text after HTML parsing.
 */
export function visibleLength(html: string): number {
  return html.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot);/g, '_').length
}
