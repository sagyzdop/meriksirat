import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type { db } from '@/db'
import {
  BIRTHDAYS_CALENDAR_ID,
  BIRTHDAY_STATUSES,
  DEFAULT_BIRTHDAYS_LOOKAHEAD_DAYS,
  DEFAULT_BIRTHDAY_WISH,
} from '../constants'
import type { BirthdaySyncResult, BirthdayUser } from '../types'

/**
 * Extracts a calendar-safe birthday from a stored string. Onboarding stores a
 * full ISO timestamp, the profile form stores `YYYY-MM-DD`, and legacy rows may
 * hold anything — so we pull the first `YYYY-MM-DD` fragment and validate it.
 */
export function parseBirthday(value: string | null | undefined): {
  month: number
  day: number
  year: number | null
} | null {
  if (!value) return null
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { month, day, year }
}

const pad = (n: number) => String(n).padStart(2, '0')

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * Reconciles the dedicated Google Calendar with D1 so it holds exactly one
 * annual all-day event per Active/Board member with a parseable birthday.
 * Idempotent and self-healing: diffs the desired set against the calendar and
 * creates/updates/deletes as needed. Callers wrap errors themselves.
 */
export async function reconcileBirthdaysToCalendar(
  database: ReturnType<typeof db>
): Promise<BirthdaySyncResult> {
  const { user, settings } = await import('@/db/schema')
  const { inArray, isNotNull, and, eq } = await import('drizzle-orm')
  const {
    listBirthdayEvents,
    createBirthdayEvent,
    updateBirthdayEvent,
    deleteBirthdayEvent,
    buildBirthdayEventBody,
  } = await import('@/lib/google/google-caledar')

  // The calendar id is editable from admin settings; fall back to the default
  // constant when it hasn't been configured yet.
  const settingsRow = await database
    .select({ birthdaysCalendarId: settings.birthdaysCalendarId })
    .from(settings)
    .where(eq(settings.id, 'global'))
    .get()
  const calendarId = settingsRow?.birthdaysCalendarId || BIRTHDAYS_CALENDAR_ID

  const result: BirthdaySyncResult = {
    created: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
  }

  const members = await database
    .select({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      birthday: user.birthday,
    })
    .from(user)
    .where(
      and(
        inArray(user.status, [...BIRTHDAY_STATUSES]),
        isNotNull(user.birthday)
      )
    )

  const desired = new Map<string, { name: string; date: string }>()

  for (const member of members) {
    const parsed = parseBirthday(member.birthday)
    if (!parsed) {
      result.skipped += 1
      continue
    }
    const name =
      [member.firstName, member.lastName].filter(Boolean).join(' ') || 'Member'
    desired.set(member.id, {
      name,
      date: `2000-${pad(parsed.month)}-${pad(parsed.day)}`,
    })
  }

  const events = await listBirthdayEvents(calendarId)
  const existing = new Map<
    string,
    { eventId: string; description: string; date?: string }
  >()

  for (const event of events) {
    const match = event.description?.match(/meriksiratUserId=([A-Za-z0-9_-]+)/)
    if (match) {
      existing.set(match[1], {
        eventId: event.id,
        description: event.description ?? '',
        date: event.start?.date,
      })
    }
  }

  for (const [userId, info] of desired) {
    const current = existing.get(userId)
    try {
      if (!current) {
        await createBirthdayEvent(calendarId, {
          userId,
          name: info.name,
          date: info.date,
        })
        result.created += 1
      } else if (current.date !== info.date) {
        await updateBirthdayEvent(
          calendarId,
          current.eventId,
          buildBirthdayEventBody({ userId, name: info.name, date: info.date })
        )
        result.updated += 1
      }
    } catch (error) {
      console.error(`Failed to sync birthday for user ${userId}:`, error)
      result.skipped += 1
    }
  }

  for (const [userId, current] of existing) {
    if (desired.has(userId)) continue
    try {
      await deleteBirthdayEvent(calendarId, current.eventId)
      result.deleted += 1
    } catch (error) {
      console.error(
        `Failed to delete birthday event for user ${userId}:`,
        error
      )
      result.skipped += 1
    }
  }

  return result
}

/**
 * Upcoming birthdays for Active/Board members within a window. Defaults to the
 * next 30 days. Birthdays recur annually, so the window wraps around year end.
 */
export const getUpcomingBirthdaysFn = createServerFn({ method: 'POST' })
  .validator((d: { from?: string; to?: string }) => d ?? {})
  .handler(async ({ data }): Promise<BirthdayUser[]> => {
    const { checkAdminPermission } = await import('@/lib/admin/server')
    const { env } = await import('cloudflare:workers')
    const { db } = await import('@/db')
    const { user } = await import('@/db/schema')
    const { inArray, isNotNull, and } = await import('drizzle-orm')

    const headers = getRequestHeaders()
    await checkAdminPermission(headers, ['admin', 'manager'])

    const database = db(env.meriksirat_d1 as D1Database)

    const today = startOfDay(new Date())
    const from = data.from ? new Date(`${data.from}T00:00:00`) : today
    const to = data.to
      ? new Date(`${data.to}T23:59:59`)
      : new Date(
          today.getTime() +
            DEFAULT_BIRTHDAYS_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000
        )

    const members = await database
      .select({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        status: user.status,
        birthday: user.birthday,
      })
      .from(user)
      .where(
        and(
          inArray(user.status, [...BIRTHDAY_STATUSES]),
          isNotNull(user.birthday)
        )
      )

    const birthdays: BirthdayUser[] = []

    for (const member of members) {
      const parsed = parseBirthday(member.birthday)
      if (!parsed) continue

      let occurrence = new Date(
        from.getFullYear(),
        parsed.month - 1,
        parsed.day
      )
      if (occurrence < from) {
        occurrence = new Date(
          from.getFullYear() + 1,
          parsed.month - 1,
          parsed.day
        )
      }
      if (occurrence > to) continue

      birthdays.push({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        status: member.status ?? 'Active',
        birthday: member.birthday ?? '',
        monthDay: `${pad(parsed.month)}-${pad(parsed.day)}`,
        occurrence: toISODate(occurrence),
        turningAge:
          parsed.year !== null ? occurrence.getFullYear() - parsed.year : null,
      })
    }

    return birthdays.sort(
      (a, b) =>
        a.occurrence.localeCompare(b.occurrence) ||
        a.firstName?.localeCompare(b.firstName ?? '') ||
        0
    )
  })

/**
 * Manual reconcile trigger for admins. Wraps the plain reconcile so the D1
 * binding stays server-side.
 */
export const syncBirthdaysToCalendarFn = createServerFn({
  method: 'POST',
}).handler(async (): Promise<BirthdaySyncResult> => {
  const { checkAdminPermission } = await import('@/lib/admin/server')
  const { env } = await import('cloudflare:workers')
  const { db } = await import('@/db')

  const headers = getRequestHeaders()
  await checkAdminPermission(headers, ['admin', 'manager'])

  const database = db(env.meriksirat_d1 as D1Database)
  return reconcileBirthdaysToCalendar(database)
})

/**
 * The editable congratulations message shown once per session in the
 * birthday-wish drawer. Deliberately NOT admin-guarded: every member needs it.
 */
export const getBirthdayWishMessageFn = createServerFn({
  method: 'GET',
}).handler(async (): Promise<string> => {
  const { env } = await import('cloudflare:workers')
  const { db } = await import('@/db')
  const { settings } = await import('@/db/schema')
  const { eq } = await import('drizzle-orm')

  const database = db(env.meriksirat_d1 as D1Database)
  const row = await database
    .select({ birthdayWishMessage: settings.birthdayWishMessage })
    .from(settings)
    .where(eq(settings.id, 'global'))
    .get()

  return row?.birthdayWishMessage ?? DEFAULT_BIRTHDAY_WISH
})
