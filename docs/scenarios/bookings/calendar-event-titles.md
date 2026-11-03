# Calendar event titles through a booking's life

> **Question:** What is the title of an item's calendar event at
> each step of a booking?
>
> **Answer:** Each item has its own event in its equipment's
> calendar. It is created as "item name - Booking" and then renamed
> as the booking moves: "(ACTIVE)" on start, "(OVERDUE)" when late,
> "(RETURNED)" on return. Cancelling deletes the event instead of
> renaming it. The description lists booking number, user,
> equipment, booked time, actual start and return when known,
> status in capitals and notes.
>
> **Notes:**
> - "item name" is the equipment model name, or "Equipment id"
>   when it has none.
> - Edits by the member always write "item name - Booking", even
>   if the booking is no longer booked. Admin edits write "item
>   name - Booking (STATUS)" with the current status in capitals.
> - Extending writes "item name (STATUS)" with the current status.
>   When the extension clears an overdue booking, the title is the
>   plain item name with no suffix.
> - Event times are in club time (Asia/Almaty). The overdue event
>   is written in UTC instead, which shows the same moment.
> - The start time of an event is the actual start once the
>   booking started, otherwise the booked start. The finish is the
>   booked finish, or the real return time after a return.
> - Overdue marking is in ../cron/bookings/mark-overdue.md and the
>   auto-cancel is in ../cron/bookings/cancel-unstarted.md. The
>   return is in return-booking.md.

```mermaid
sequenceDiagram
    autonumber
    participant W as Worker
    participant C as Calendar
    participant Cr as Cron
    participant T as Telegram
    W->>C: Create booking or add items:<br/>"item name - Booking", status BOOKED
    W->>C: Member edit of times or notes:<br/>"item name - Booking"
    W->>C: Admin edit of times or notes:<br/>"item name - Booking (STATUS)"
    W->>C: Start pickup: "item name (ACTIVE)",<br/>start = actual start, finish as booked
    W->>C: Extend by 30 min: "item name (STATUS)",<br/>or plain "item name" if overdue was cleared
    Cr->>C: Booking runs late: "item name (OVERDUE)"<br/>see mark-overdue.md
    T->>W: Return completed in the bot
    W->>C: "item name (RETURNED)", finish = return time
    W->>C: Cancel booking or item: event deleted
    Cr->>C: Start window missed: event deleted<br/>see cancel-unstarted.md
```
