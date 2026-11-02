# Manage Bookings list (admin)

> **Question:** What does an admin or manager see on Manage
> Bookings?
>
> **Answer:** A paged list of every member's bookings with the
> booker's name, email and photo, and the items. Like the member
> list it hides returned and cancelled bookings until a status
> filter is chosen, and it keeps sort, filters and page in the web
> address. Only admins and managers can load it. Anyone else gets
> an empty list because the load error is logged and ignored.
>
> **Notes:**
> - Sort choices on this page: start time (default), end time,
>   status, created time. The server also supports sorting by the
>   booker's email and by equipment name, but the page does not
>   offer them.
> - Page size is 50 by default, at most 100.
> - A banner at the top counts overdue bookings.
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
    A->>B: Change sort, status, dates, page or tap Reset
    B->>B: Update the web address and load the list again
```
