# Manage Bookings list (admin)

> **Question:** What does an admin or manager see on Manage
> Bookings?
>
> **Answer:** A paged list of every member's bookings with the
> booker's name, email and photo, and the items. Like the member
> list it hides returned and cancelled bookings until a status
> filter is chosen, and it keeps sort, filters and page in the web
> address. Only admins and managers can open the page. Anyone else
> sees a "Page not found" error before the list is asked for.
>
> **Notes:**
> - The page has one sort button, Booking Time, which flips the
>   start time between oldest first (default) and newest first. The
>   address can also carry end time, status or created time. The
>   server can sort by the booker's email and by equipment name too,
>   but this page's address rules do not accept those.
> - Page size is 50 by default, at most 100.
> - A red banner at the top counts bookings on the shown page that
>   are active or partially returned and past their finish time.
> - Each row can be ticked, and "Cancel Selected" cancels the
>   ticked bookings, see admin-cancel-booking.md.
> - The booker's name links to the user page in the admin console.
> - Row actions lead to admin-booking-details.md,
>   admin-edit-booking.md and admin-cancel-booking.md.
> - Date filters work the same way as in my-bookings-list.md.

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin or manager
    participant B as Browser
    participant W as Worker
    participant D as D1
    A->>B: Open Manage Bookings /admin/bookings
    alt role is not admin or manager
        B-->>A: Error "Page not found"
    end
    B->>B: No status chosen so use booked, active, overdue,<br/>partially_returned
    B->>W: getAdminBookingsFn(filters, page, limit 50, sort)
    W->>D: Read session user and role
    alt no session
        W-->>B: Error "Unauthorized: No session"
    else role is not admin or manager
        W-->>B: Error "Insufficient permissions"
    end
    W->>D: Count and select bookings with filters and sort,<br/>joined to the booker
    W->>D: Read items with equipment and category for this page
    W-->>B: bookings with booker, items and page info
    alt the call failed
        B->>B: Log the error and show an empty list
    end
    B-->>A: "Manage Bookings" with the list and overdue banner
    A->>B: Tap Booking Time, change status, dates or page,<br/>or tap Reset
    B->>B: Update the web address and load the list again
```
