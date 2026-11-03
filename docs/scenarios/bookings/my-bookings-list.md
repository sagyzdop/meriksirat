# My Bookings list

> **Question:** What does a member see on the My Bookings page and
> how do filters and paging work?
>
> **Answer:** The page lists only the signed-in member's own
> bookings with their items, 50 per page by default. Until the
> member chooses a status filter it shows booked, active, overdue
> and partially returned bookings and hides returned and cancelled
> ones. Sorting, status, date range and page are kept in the web
> address, so each change loads the list again. If the list call
> fails the page opens with an empty list.
>
> **Notes:**
> - The page has one sort button, Booking Time, which flips the
>   start time between oldest first (default) and newest first. The
>   address can also carry end time, status, created time or
>   equipment name (alphabetically first item). Page size at most
>   100 per request.
> - Only club members reach this page. Anyone else is sent to
>   their profile page.
> - Each row can be ticked, and "Cancel Selected" cancels the
>   ticked bookings, see cancel-booking.md.
> - Date filter: start date keeps bookings starting on or after it.
>   End date keeps bookings finishing by the end of that day. The
>   day boundaries come from the browser's own time zone.
> - The server can also filter by one equipment id, but this page
>   has no control for it.
> - A visitor without a session gets null from the list call and
>   the page shows the empty list.
> - Opening a row's actions leads to booking-details.md,
>   edit-booking.md, cancel-booking.md or cancel-item.md.
> - The Telegram bot username is used for the Return link on active
>   bookings, see return-booking.md.

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    M->>B: Open My Bookings /bookings
    B->>B: No status chosen so use booked, active, overdue,<br/>partially_returned
    B->>W: getUserBookingsFn(filters, page, limit 50, sort)
    W->>D: Read session user
    alt no session
        W-->>B: null
        B-->>M: Empty list, "No bookings found"
    else signed in
        W->>D: Count and select this member's bookings<br/>with status, date and sort filters
        W->>D: Read items with equipment and category<br/>for the bookings on this page
        W-->>B: bookings with items and page info
    end
    B->>W: getTelegramBotUsernameFn()
    W-->>B: Bot username from the environment
    alt either call fails
        B->>B: Log the error and carry on with empty values
    end
    B-->>M: "My Bookings", "You have N bookings"
    M->>B: Tap Booking Time, change status, dates or page
    B->>B: Update the web address and load the list again
    M->>B: Tap Reset (shown only while a filter is set)
    B->>B: Page 1, start time ascending, default status filter
```
