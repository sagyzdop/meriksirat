import { describe, expect, it } from 'vitest'
import {
  formatAlbumLog,
  formatBookingLog,
  visibleLength,
  type BookingLogData,
} from '@/lib/telegram/log-format'

// Club time is UTC+5, so 09:00Z renders as 14:00.
const at = (iso: string) => new Date(iso)

const base: BookingLogData = {
  bookingId: 142,
  event: 'booked',
  userName: 'Aida Nurlanova (@aida_n)',
  equipmentNames: ['Sony A7 III', 'Rode VideoMic'],
  itemStatuses: ['booked', 'booked'],
  startTime: at('2026-10-27T09:00:00Z'),
  endTime: at('2026-10-27T11:00:00Z'),
  eventDetails: 'Debate club recording',
  url: 'https://example.com/admin/bookings/142',
  now: at('2026-10-27T08:00:00Z'),
}

const link = '🔗 <a href="https://example.com/admin/bookings/142">Link</a>'

describe('formatBookingLog', () => {
  it('names the member in the header when they acted', () => {
    expect(formatBookingLog(base)).toBe(
      [
        '🆕 Booked by Aida Nurlanova (@aida_n)',
        '',
        '📷 Sony A7 III, Rode VideoMic',
        '💬 Debate club recording',
        '',
        '🕑 Oct 27, 14:00–16:00',
        link,
        '#booking142',
      ].join('\n')
    )
  })

  it('shows pickup time and keeps event details on later events', () => {
    const text = formatBookingLog({
      ...base,
      event: 'returned',
      itemStatuses: ['returned', 'returned'],
      startedAt: at('2026-10-27T08:45:00Z'),
    })
    expect(text).toBe(
      [
        '✅ Returned by Aida Nurlanova (@aida_n)',
        '',
        '📷 Sony A7 III, Rode VideoMic',
        '💬 Debate club recording',
        '',
        '🕑 Oct 27, 14:00–16:00 (picked up at 13:45)',
        link,
        '#booking142',
      ].join('\n')
    )
  })

  it('renders extensions with the cleared overdue flag', () => {
    const text = formatBookingLog({
      ...base,
      event: 'extended',
      endTime: at('2026-10-27T11:30:00Z'),
      extendedMinutes: 30,
      overdueCleared: true,
    })
    expect(text).toContain('⏩ Extended +30 min by Aida Nurlanova (@aida_n)')
    expect(text).toContain('🕑 Oct 27, 14:00–16:30 (overdue cleared)')
  })

  it('attributes cron events to the system and names the member', () => {
    expect(formatBookingLog({ ...base, event: 'overdue' })).toContain(
      '⚠️ Overdue by system\n👤 Aida Nurlanova (@aida_n)'
    )
    expect(formatBookingLog({ ...base, event: 'auto_cancelled' })).toContain(
      '⏱ Auto-cancelled (no pickup) by system'
    )
  })

  it('separates added items from existing ones', () => {
    const text = formatBookingLog({
      ...base,
      event: 'items_added',
      addedItems: ['Rode VideoMic'],
    })
    expect(text).toContain('📷 Sony A7 III\n➕ Rode VideoMic')
  })

  it('shows only what changed on an admin edit', () => {
    const text = formatBookingLog({
      ...base,
      event: 'edited',
      actorName: 'Dana Seitkali (@dana_s)',
      startTime: at('2026-10-27T10:00:00Z'),
      endTime: at('2026-10-27T12:00:00Z'),
      eventDetails: 'Debate finals recording',
      previous: {
        startTime: base.startTime,
        endTime: base.endTime,
        eventDetails: 'Debate club recording',
      },
    })
    expect(text).toContain(
      '✏️ Edited by Dana Seitkali (@dana_s)\n👤 Aida Nurlanova (@aida_n)'
    )
    expect(text).toContain('🕑 Oct 27, 14:00–16:00 → 15:00–17:00')
    expect(text).toContain('💬 Debate club recording → Debate finals recording')
  })

  it('omits the details line when an edit leaves them unchanged', () => {
    const text = formatBookingLog({
      ...base,
      event: 'edited',
      previous: {
        startTime: base.startTime,
        endTime: base.endTime,
        eventDetails: base.eventDetails,
      },
    })
    expect(text).toContain('🕑 Oct 27, 14:00–16:00\n')
    expect(text).not.toContain('💬')
    expect(text).not.toContain('👤')
  })

  it('strikes through the items in a partial cancellation', () => {
    const text = formatBookingLog({
      ...base,
      event: 'cancelled',
      itemStatuses: ['booked', 'cancelled'],
    })
    expect(text).toContain('❌ Cancelled 1 of 2 by Aida Nurlanova (@aida_n)')
    expect(text).toContain('📷 Sony A7 III, <s>Rode VideoMic</s>')
  })

  it('renders a full cancellation without a count', () => {
    const text = formatBookingLog({
      ...base,
      event: 'cancelled',
      actorName: 'Dana Seitkali (@dana_s)',
      itemStatuses: ['cancelled', 'cancelled'],
      reason: 'Camera sent for repair',
    })
    expect(text).toContain('❌ Cancelled by Dana Seitkali (@dana_s)')
    expect(text).toContain('📷 Sony A7 III, Rode VideoMic')
    expect(text).toContain('Reason: Camera sent for repair')
  })

  it('drops the link on deletion but keeps the hashtag', () => {
    const text = formatBookingLog({
      ...base,
      event: 'deleted',
      actorName: 'Dana Seitkali (@dana_s)',
    })
    expect(text).not.toContain('🔗')
    expect(text.endsWith('🕑 Oct 27, 14:00–16:00\n#booking142')).toBe(true)
  })

  it('adds the year only outside the current year', () => {
    const text = formatBookingLog({
      ...base,
      startTime: at('2027-01-03T05:00:00Z'),
      endTime: at('2027-01-03T07:00:00Z'),
    })
    expect(text).toContain('🕑 Jan 3, 2027, 10:00–12:00')
  })

  it('shows both days for bookings that cross midnight', () => {
    const text = formatBookingLog({
      ...base,
      startTime: at('2026-10-27T17:00:00Z'),
      endTime: at('2026-10-27T20:00:00Z'),
    })
    expect(text).toContain('🕑 Oct 27, 22:00 – Oct 28, 01:00')
  })

  it('escapes HTML in user-provided text', () => {
    const text = formatBookingLog({
      ...base,
      userName: 'A <b>&</b> B',
      eventDetails: '<script>',
    })
    expect(text).toContain('by A &lt;b&gt;&amp;&lt;/b&gt; B')
    expect(text).toContain('💬 &lt;script&gt;')
  })

  it('clips long free text', () => {
    const text = formatBookingLog({ ...base, eventDetails: 'x'.repeat(500) })
    const details = text.split('\n').find((line) => line.startsWith('💬'))!
    expect(details.length).toBeLessThan(210)
    expect(details.endsWith('…')).toBe(true)
  })

  it('can collapse the equipment list to a count', () => {
    expect(formatBookingLog(base, { compactEquipment: true })).toContain(
      '📷 2 items'
    )
  })
})

describe('formatAlbumLog', () => {
  const album = {
    albumId: 'x7Kp2QaZ9m',
    albumTitle: 'Autumn Fest',
    actorName: 'Aida Nurlanova (@aida_n)',
    url: 'https://example.com/albums/x7Kp2QaZ9m',
  }
  const albumLink =
    '🔗 <a href="https://example.com/albums/x7Kp2QaZ9m">Link</a>'

  it('renders edits with the title set apart', () => {
    expect(
      formatAlbumLog({
        ...album,
        action: 'updated',
        details: ['Title: Fall Fest → Autumn Fest'],
      })
    ).toBe(
      [
        '✏️ Album edited by Aida Nurlanova (@aida_n)',
        '',
        '🖼 Autumn Fest',
        '',
        'Title: Fall Fest → Autumn Fest',
        albumLink,
        '#x7Kp2QaZ9m',
      ].join('\n')
    )
  })

  it('matches the unshared layout', () => {
    expect(formatAlbumLog({ ...album, action: 'unshared' })).toBe(
      [
        '🔐 Album unshared by Aida Nurlanova (@aida_n)',
        '',
        '🖼 Autumn Fest',
        '',
        albumLink,
        '#x7Kp2QaZ9m',
      ].join('\n')
    )
  })

  it('names the editor who joined', () => {
    expect(formatAlbumLog({ ...album, action: 'member_added' })).toContain(
      '➕ Editor joined: Aida Nurlanova (@aida_n)'
    )
  })

  it('drops the link on deletion', () => {
    expect(formatAlbumLog({ ...album, action: 'deleted' })).toBe(
      [
        '🗑 Album deleted by Aida Nurlanova (@aida_n)',
        '',
        '🖼 Autumn Fest',
        '',
        '#x7Kp2QaZ9m',
      ].join('\n')
    )
  })
})

describe('visibleLength', () => {
  it('counts text after Telegram parses the HTML', () => {
    expect(visibleLength('<s>a&amp;b</s> <a href="x">Link</a>')).toBe(8)
  })
})
