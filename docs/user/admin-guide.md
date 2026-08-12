# Admin Guide

Administrative operations in Meriksirat.

## Dashboard

Overview charts of bookings, equipment usage, and system statistics. Quick actions jump to the common admin tasks.

## Equipment Management

- **Add / edit equipment**: model name, short name, description, category, required clearance level, Google Calendar ID, optional image, and active status.
- **Delete** only removes equipment with no booking history; equipment with history is **deactivated** instead to preserve records.
- Clearance levels gate who can book what — level 10 is the most restrictive.

## User Management

- Change roles and clearance levels.
- **Bulk edit**: select multiple users and change clearance in one action.
- **Violation counters**: the UI shows violation counts and an admin action to clear them.

## Booking Oversight

- Full list of all bookings with server-side pagination, sorting, and status filtering.
- **Edit a booking**: update admin notes (appended to booking history with your email) and, while the booking is `booked`/`active`, change its schedule — changes sync to Google Calendar.
- **Cancel a booking** (with an optional reason) removes its calendar events.
- **Bulk cancel**: select multiple bookings and cancel them together.

## Category Management

Create and edit equipment categories (used for faceted filtering and catalog grouping).

## Albums

Manage public and member albums; the admin album list mirrors the member "My Albums" experience.

## Settings

Operating hours, booking limits, and global notification preferences.

## Notes

- Statuses include `booked`, `active`, `partially_returned`, `returned`, `cancelled`, and `overdue` (derived when end time passes).
- Overdue bookings show a prominent alert on the edit page and are auto-flagged; cron jobs handle auto-cancellation and reminder schedules.
- Admin notes and status changes sync with Google Calendar and can notify members via Telegram.
