# Choosing a booking to start in Telegram

> **Question:** What happens when a member taps "Start Booking" or
> sends `/start_booking`, and picks a booking?
>
> **Answer:** The bot lists the member's bookings that are still
> "booked" and whose start window is open, as buttons. Tapping one
> shows its equipment and time and asks for Confirm or Cancel. If
> there is nothing startable it explains the 15 minute window.
>
> **Notes:**
> - Window: from 15 minutes before the start time to 15 minutes
>   after it, and the booking must not have been started.
> - Listing saves step `awaiting_start_selection` in KV with a
>   1 hour expiry. Picking saves `awaiting_start_confirm` and the
>   booking id, but only if the booking was found.
> - Button text is "Booking #35;id — equipment names". The id is read
>   back from that text. Any other text gets the "tap one of the
>   buttons" reply.
> - Confirming is in `start-booking-confirm.md`.

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Worker
    participant D1
    participant KV
    participant Telegram
    Member->>Worker: /start_booking or "▶️ Start Booking"<br/>renderStartBookingList(ctx)
    Worker->>D1: requireLinkedUser(ctx)
    alt chat not linked
        Worker->>Telegram: "Please link your account via /start first."
    else linked
        Worker->>D1: listStartableBookings<br/>status booked, not started, within 15 min
        alt none
            Worker->>Telegram: "You have no bookings to start right now."<br/>+ "Your booking can be started up to 15 minutes<br/>before its start time, and up to 15 minutes after."
        else some
            Worker->>KV: session step awaiting_start_selection, 1 hour
            Worker->>Telegram: "Select which booking to start:"<br/>one button per booking + "🏠 Main Menu"
        end
    end
    Member->>Worker: taps "Booking #35;id — equipment"<br/>handleFlowText then renderStartConfirm
    alt text has no Booking #35;number
        Worker->>Telegram: "Please tap one of the buttons above."
    else chat no longer linked
        Worker->>Telegram: showMainMenu(ctx)
    else booking not owned or missing
        Worker->>Telegram: "Booking not found."<br/>+ "🏠 Main Menu" button
    else found
        Worker->>Telegram: "Start booking #35;id now?" with equipment and<br/>time range, "Tap Confirm to start, or Cancel."<br/>buttons "✅ Confirm", "Cancel", "🏠 Main Menu"
        Worker->>KV: session step awaiting_start_confirm, startBookingId
    end
```
