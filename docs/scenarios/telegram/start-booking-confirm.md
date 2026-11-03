# Confirming the start of a booking in Telegram

> **Question:** What happens when the member taps Confirm or Cancel
> on the "Start booking now?" question?
>
> **Answer:** Confirm starts the booking: its items become active,
> the calendar events are updated, the club channel gets a "Picked
> up" log, and the member sees "✅ Booking #35;id has been started."
> If the booking cannot be started, the bot replies with the reason.
> Cancel replies "Start cancelled."
>
> **Notes:**
> - Starting uses the same `startBooking` as the web "Start pickup".
>   It only works for the booking's owner.
> - If the member has a Telegram chat and the settings have a Global
>   Booking Note, the note is sent as a separate message.
> - The saved step is not cleared after starting, so a second
>   Confirm within the hour gets the "cannot be started from status"
>   reply.
> - Other text gets "Send Confirm or Cancel."
> - Other refusals use the same pattern: "Booking not found.",
>   "Booking has already been started.", "Booking has no items
>   that can be started." and 'Booking cannot be started from
>   status "x".' A start after the window gets "Booking start
>   window has passed" and says the booking will be auto-cancelled.
> - Calendar and log failures are logged to the console only and do
>   not stop the start.
> - Channel logging is in `channel-log.md`.

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Worker
    participant D1
    participant Calendar
    participant Telegram
    Member->>Worker: "✅ Confirm", "Cancel" or other text<br/>handleFlowText at awaiting_start_confirm
    alt chat no longer linked or no booking id saved
        Worker->>Telegram: showMainMenu(ctx)
    else text is "Cancel"
        Worker->>Telegram: "Start cancelled." + "🏠 Main Menu" button
    else text is not Confirm
        Worker->>Telegram: "Send Confirm or Cancel."
    else text is Confirm
        Worker->>D1: startBookingForChat then startBooking(bookingId)<br/>checks owner, status, 15 minute window
        alt BookingStartError
            Worker->>Telegram: reason + "." for example "Booking can be started up<br/>to 15 minutes before the start time."
        else started
            Worker->>D1: set booking.started_at, items = active,<br/>recompute booking status
            Worker->>Calendar: update each item event to "(ACTIVE)"<br/>with the real start time
            Worker->>Telegram: channel log "▶️ Picked up"
            Worker->>Telegram: Global Booking Note to the member, if set
            Worker->>Telegram: "✅ Booking #35;id has been started."<br/>"The equipment is now marked as picked up.<br/>Use the Return Equipment flow when done."
        end
    end
```
