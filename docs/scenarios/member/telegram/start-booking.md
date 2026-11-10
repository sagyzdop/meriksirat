# Start a booking from Telegram

Related: [bot routing](bot-routing.md), [pickup on the web](../bookings/), [GLOSSARY: Start window](../../../../GLOSSARY.md), [channel log](notifications.md).

## How does a member pick up equipment through the bot?

```mermaid
sequenceDiagram
    autonumber
    actor M as Member
    participant W as Worker
    participant D as D1
    participant K as D1 app_state
    participant C as Calendar
    participant T as Telegram
    M->>W: "▶️ Start Booking" or /start_booking
    W->>D: Booked bookings inside the start window
    alt None
        W->>T: "You have no bookings to start right now." and the 15 minute rule
    else Some
        W->>K: Step awaiting_start_selection
        W->>T: Buttons "Booking #id — equipment"
    end
    M->>W: Taps a booking
    W->>K: Step awaiting_start_confirm, booking id
    W->>T: "Start booking #id now?" with equipment and time, buttons Confirm, Cancel
    M->>W: "✅ Confirm"
    W->>D: startBooking (owner, status and window checked)
    alt Refused
        W->>T: The reason, for example start window passed or already started
    else Started
        W->>D: started_at set, items active, booking status recomputed
        W->>C: Item events updated to ACTIVE with the real start time
        W->>T: Channel log "▶️ Picked up", the Global Booking Note if set, then "✅ Booking #id has been started."
    end
```

- This is the same `startBooking` as the web Start pickup button. The window runs from 15 minutes before to 15 minutes after the start time.
- "Cancel" replies "Start cancelled." Other text at the confirm step gets "Send Confirm or Cancel."
- The saved step is not cleared, so a second Confirm within the hour gets a "cannot be started from status" reply.
- Calendar and channel log failures are only logged to the console.
