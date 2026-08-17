# Calendar Viewer

A custom read-only weekly/monthly calendar view that replaced Google Calendar
iframe embeds. Shows equipment availability directly in booking and equipment
pages without the iframe overhead.

## Architecture

- `GoogleCalendarView` (`src/components/shared/event-calendar/google-calendar-view.tsx`)
  fetches events from the server for the visible date range, maps them to
  `CalendarEvent`, and renders `EventCalendar` in read-only mode.
- `EventCalendar` (`src/components/shared/event-calendar/event-calendar.tsx`)
  supports `readOnly` prop (disables creation, update, delete, drag-drop),
  `availableViews` to limit views (week/month), and `onRangeChange` callback
  to report the visible range for API fetches.
- The server function fetches Google Calendar events for the requested range
  only. Events are not cached client-side; each range change re-fetches.

## Used in

- Equipment detail page (availability badge section)
- New booking page (equipment availability)
- Booking edit page (admin)
- Booking detail page

## Replaced

- Google Calendar iframe embeds (removed `getAuthenticatedCalendarEmbedUrl`)
- The old `/api/drive-image` proxy was also removed; photos now serve
  directly from Google's CDN
