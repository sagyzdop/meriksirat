# Listing my bookings in Telegram

> **Question:** What does `/my_bookings` show?
>
> **Answer:** It lists the member's bookings that are upcoming,
> active or overdue, with the date, the start and end times in club
> time, and each piece of equipment with its status. If there are
> none it says "You have no active or upcoming bookings."
>
> **Notes:**
> - Bookings are chosen by item status (booked, active, overdue),
>   so a partly returned booking appears only through its items
>   that are still out.
> - A booking is labelled "Upcoming", "Active", "Overdue" or
>   "Partially Returned" by its own status.
> - Read-only. No session is saved.

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Worker
    participant D1
    participant Telegram
    Member->>Worker: /my_bookings or "📋 My Bookings"<br/>renderMyBookings(ctx)
    Worker->>D1: requireLinkedUser(ctx)
    alt chat not linked
        Worker->>Telegram: "Please link your account via /start first."
    else linked
        Worker->>D1: fetchUserBookings with item status<br/>booked, active, overdue
        alt no rows
            Worker->>Telegram: "You have no active or upcoming bookings."<br/>+ "🏠 Main Menu" button
        else rows found
            Worker->>Telegram: "Your bookings:" then per booking<br/>label, Booking id, date and time range,<br/>and each item with its status
        end
    end
    Telegram-->>Member: message shown
```
