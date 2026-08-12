# Member Guide

How to use Meriksirat as a club member.

## Your account

- On first login you complete an onboarding profile (name, date of birth, NU ID, major, graduation year). In production you also link your Telegram account — this is where booking notifications arrive.
- Your profile page shows your account details and lets you manage your Telegram connection.

## Booking equipment

1. Browse the **Equipment** catalog. Equipment you don't have clearance for is not shown.
2. Open a piece of equipment to see its **Availability** (Google Calendar) and pick time slots — select one or more consecutive 30-minute slots.
3. You can also select **multiple equipment** from the catalog and book them together: the cart persists in `localStorage` and the new-booking page shows all selected items, each color-coded on the shared availability calendar.
4. Confirm the booking. Conflicts are detected server-side; if a slot is taken you'll be told which item conflicts.

## During a booking

- **Start pickup**: when your booking window opens you get a 30-minute window to confirm pickup, or the booking is auto-cancelled.
- **Direct handover**: you can hand equipment directly to the next person in line without returning to the locker.
- **Partial returns**: return some items while keeping others; each return logs an actual timestamp.
- **Photo verification**: returns may require a timestamped photo.
- **Extensions**: extend a booking by 30 minutes if the next slot is free.

## My Bookings

- Every booking you've made, with status (`booked`, `active`, `partially_returned`, `returned`, `cancelled`, `overdue`) and the option to cancel a `booked` booking.
- Overdue items show alerts; return them as soon as possible.

## Albums

- **Public Albums** are viewable by everyone. **My Albums** are yours; you can set visibility (public/private) and upload photos. Uploads queue in the site header progress widget — click an album row there to jump to that album's uploads.

## FAQ

Check the FAQ page for club-specific answers before asking an admin.
