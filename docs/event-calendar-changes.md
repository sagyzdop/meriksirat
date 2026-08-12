
# Calendar Embed Replacement - Change Log

This file documents the changes made to replace Google Calendar iframe embeds with a custom, read-only weekly calendar view. It also covers follow-up fixes for sizing, scrolling, build warnings, and time-slot refresh behavior. Minor styling-only edits are mentioned briefly.

## 1. Added a Google Calendar viewer wrapper (read-only)

**Purpose:** Render Google Calendar events inside the custom calendar UI while keeping it view-only and syncing to the active date range.

**What changed:** Added a new component that calls the server function to fetch events, maps them to `CalendarEvent`, and renders `EventCalendar` in read-only mode with week view as default.

**File:** src/components/shared/event-calendar/google-calendar-view.tsx

**Key logic:**
```tsx
const mapped = (items || [])
	.map(toCalendarEvent)
	.filter((item): item is CalendarEvent => Boolean(item))

setEvents(mapped)
```

```tsx
<EventCalendar
	events={events}
	initialView="week"
	availableViews={["week", "month"]}
	readOnly
	onRangeChange={handleRangeChange}
	containerClassName="h-full overflow-hidden"
/>
```

**Notes:**
- Events are fetched for the visible range only.
- The view is read-only and still opens the details dialog on click.

## 2. EventCalendar upgraded for read-only usage + range callbacks

**Purpose:** Allow the calendar UI to be used as a viewer without creating/editing events, and expose the visible date range to the wrapper for API fetches.

**File:** src/components/shared/event-calendar/event-calendar.tsx

**Additions:**
- `readOnly` prop that disables creation, update, delete, and drag behaviors.
- `availableViews` prop so the wrapper can limit views (week/month only).
- `onRangeChange` callback that reports the visible range (month/week/day/agenda).
- `containerClassName` for sizing the calendar root from the wrapper.
- `weekCellsHeight` to control vertical scale in constrained layouts.

**Key logic:**
```tsx
useEffect(() => {
	if (!onRangeChange) return

	if (view === "month") {
		onRangeChange({
			start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }),
			end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 }),
			view,
		})
		return
	}

	if (view === "week") {
		onRangeChange({
			start: startOfWeek(currentDate, { weekStartsOn: 0 }),
			end: endOfWeek(currentDate, { weekStartsOn: 0 }),
			view,
		})
		return
	}

	if (view === "day") {
		onRangeChange({
			start: startOfDay(currentDate),
			end: endOfDay(currentDate),
			view,
		})
		return
	}

	onRangeChange({
		start: startOfDay(currentDate),
		end: endOfDay(addDays(currentDate, AgendaDaysToShow - 1)),
		view,
	})
}, [currentDate, onRangeChange, view])
```

```tsx
const handleEventCreate = (startTime: Date) => {
	if (readOnly) return
	// ...
}
```

## 3. Read-only enforcement in event detail dialog

**Purpose:** Show event details without allowing edits or deletes in view-only mode.

**File:** src/components/shared/event-calendar/event-dialog.tsx

**Changes:**
- `readOnly` prop to disable form fields and hide edit/delete actions.
- Dialog title/description adapted for view-only usage.

**Example:**
```tsx
<DialogTitle>
	{isReadOnly ? "Event Details" : event?.id ? "Edit Event" : "Create Event"}
</DialogTitle>
```

## 4. Disabled drag/drop + creation in month/week/day views

**Purpose:** Prevent creating or moving events when the calendar is in read-only mode.

**Files:**
- src/components/shared/event-calendar/month-view.tsx
- src/components/shared/event-calendar/week-view.tsx
- src/components/shared/event-calendar/day-view.tsx
- src/components/shared/event-calendar/draggable-event.tsx
- src/components/shared/event-calendar/droppable-cell.tsx

**Key behavior:**
- `DroppableCell` now supports `disabled`.
- `DraggableEvent` now supports `disabled`.
- Views pass `readOnly` to prevent interaction.

**Snippet:**
```tsx
<DroppableCell
	id={cellId}
	date={day}
	disabled={readOnly}
	onClick={() => {
		if (readOnly) return
		// create event
	}}
/>
```

## 5. Replaced iframe embeds with the new viewer

**Purpose:** Remove Google Calendar iframe embeds and use the custom calendar view everywhere.

**Files updated:**
- src/components/admin/bookings/$.edit/index.tsx
- src/components/bookings/bookings_/$bookingId/index.tsx
- src/components/bookings/new/index.tsx
- src/components/equipment/$/index.tsx

**Example replacement:**
```tsx
{booking.equipment?.googleCalendarId && (
	<div className="space-y-4">
		<h2 className="text-xl font-semibold">Availability</h2>
		<GoogleCalendarView calendarId={booking.equipment.googleCalendarId} />
	</div>
)}
```

## 6. Removed embed URL helper

**Purpose:** The embed URL API is no longer needed once we render the calendar directly.

**File:** src/lib/google/google-caledar.ts

**Removed:** `getAuthenticatedCalendarEmbedUrl` server function.

## 7. Fixed infinite reload in calendar viewer

**Problem:** The viewer was re-fetching events on every render because the range object was always updated even if unchanged.

**Fix:** Only update `range` when it actually changes.

**File:** src/components/shared/event-calendar/google-calendar-view.tsx

```tsx
setRange((prev) => {
	if (!prev) return nextRange

	const sameView = prev.view === nextRange.view
	const sameStart = prev.start.getTime() === nextRange.start.getTime()
	const sameEnd = prev.end.getTime() === nextRange.end.getTime()

	return sameView && sameStart && sameEnd ? prev : nextRange
})
```

## 8. Sizing and scrolling adjustments

**Goal:** Match the old iframe height (600px) but allow scrolling inside the calendar when needed.

**Changes:**
- Constrained the viewer to a fixed height and `overflow-hidden`.
- Enabled vertical scroll within the week/day timeline areas.

**Files:**
- src/components/shared/event-calendar/google-calendar-view.tsx
- src/components/shared/event-calendar/event-calendar.tsx
- src/components/shared/event-calendar/week-view.tsx
- src/components/shared/event-calendar/day-view.tsx

**Snippet:**
```tsx
<div className={cn("h-150 overflow-hidden", className)}>
	<EventCalendar
		// ...
		containerClassName="h-full overflow-hidden"
	/>
</div>
```

```tsx
<div data-slot="week-view" className="flex h-full flex-col overflow-y-auto">
	{/* timeline grid */}
</div>
```

## 9. Rollup circular chunk warning fix

**Problem:** Re-exporting GoogleCalendarView through the event-calendar index caused circular chunk dependencies.

**Fix:** Removed the re-export and imported the component directly in call sites.

**Files:**
- src/components/shared/event-calendar/index.ts (removed export)
- src/components/admin/bookings/$.edit/index.tsx
- src/components/bookings/bookings_/$bookingId/index.tsx
- src/components/bookings/new/index.tsx
- src/components/equipment/$/index.tsx

## 10. TimeSlotPicker refresh noise fix

**Problem:** The available time slots refreshed on unrelated re-renders because `excludeBookingPeriod` was an unstable object.

**Fix:** Depend on `excludeBookingPeriod.start` and `.end` values instead of the object reference.

**File:** src/components/shared/time-slot-picker.tsx

```tsx
const excludeStart = excludeBookingPeriod?.start ?? null
const excludeEnd = excludeBookingPeriod?.end ?? null

const checkAvailability = React.useCallback(
	async (selectedDate: Date) => {
		// ...
	},
	[googleCalendarId, excludeStart, excludeEnd]
)
```

## Minor styling-only changes (brief)

- Tailwind class normalization tweaks (e.g., `min-h-150`, `h-0.5`, `min-h-(--week-cells-height)`), to match lint preferences.
- Small flex/overflow adjustments to avoid parent overflow and improve scroll behavior.

