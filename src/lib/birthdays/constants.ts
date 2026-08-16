/**
 * Dedicated Google Calendar for member birthdays. Populated with one annual
 * all-day recurring event per Active/Board member.
 */
export const BIRTHDAYS_CALENDAR_ID =
  'c_5f537448722fdd7710a947044bad89339f9cf52d8203995819f8c3465130af19@group.calendar.google.com'

/** Only these user statuses count for birthdays. */
export const BIRTHDAY_STATUSES = ['Active', 'Board'] as const
export type BirthdayStatus = (typeof BIRTHDAY_STATUSES)[number]
