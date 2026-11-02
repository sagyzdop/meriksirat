# Unban A Member

> **Question:** What happens when an admin lifts a member's ban?
>
> **Answer:** The admin opens the banned member's page, presses Unban user and confirms. The ban date, reason and banning admin are cleared, the person can sign in again, and the club channel gets an unban message. The admin sees the toast "Name was unbanned". Bookings that were cancelled stay cancelled and flamekeeping is not restored, so the person must connect their Drive again themselves.
>
> **Notes:**
> - Admin only. The Ban section is never shown to a manager.
> - Sessions deleted by the ban are not brought back. The person signs in fresh.
> - The channel message is skipped quietly if channel logging is off.
> - The ban itself is in [ban-member.md](ban-member.md).

```mermaid
sequenceDiagram
    autonumber
    actor Person as Admin
    participant Browser
    participant Worker
    participant D1
    participant Telegram

    Person->>Browser: click Unban user on the member page
    Browser-->>Person: dialog Unban name?
    Person->>Browser: click Unban
    Browser->>Worker: unbanUserFn(userId)
    alt caller is not an admin
        Worker-->>Browser: error "Insufficient permissions"
    else target not found
        Worker-->>Browser: error "User not found"
    else target is not banned
        Worker-->>Browser: error "User is not banned"
    else allowed
        Worker->>D1: clear banned_at, ban_reason, banned_by
        Worker->>Telegram: unban message to the club channel
        Worker-->>Browser: success
        Browser-->>Person: toast "Name was unbanned"
        Browser->>Browser: refresh all queries and the page data
    end
    alt call failed
        Browser-->>Person: toast with the error or "Failed to unban user"
    end
```
