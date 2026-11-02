# Ban A Member

> **Question:** What happens when an admin bans a member?
>
> **Answer:** The admin opens the member's page, presses Ban user, types a reason of up to 500 characters and confirms. The person is signed out at once and cannot sign in again. Their upcoming bookings are cancelled, their access to album folders is removed and any photos they keep as a flamekeeper start moving to others. The club channel gets a ban message. The admin sees the toast "Name was banned". Bookings that are already active or overdue stay so the return is still tracked.
>
> **Notes:**
> - Admin only. A manager does not see the Ban section. An admin cannot ban themselves, and the club's master account cannot be banned.
> - The follow-up work (cancelling bookings and removing folder access) is run right away, but only a small amount per run: 3 upcoming bookings and 10 folder accesses. If it fails or there is more, the 5-minute cron picks it up, see [../cron/flamekeepers/](../cron/flamekeepers/).
> - A flamekeeper with photos is put into a 14-day drain with reason ban, and one without photos is marked drained at once. A drain already running for another reason keeps its earlier deadline. Moving the photos is described in [../flamekeepers/](../flamekeepers/).
> - Banned people who try to sign in are sent to /login with an error "banned". That side is in [../account/](../account/).
> - The channel message is skipped quietly if channel logging is off.
> - Lifting a ban is in [unban-member.md](unban-member.md).

```mermaid
sequenceDiagram
    autonumber
    actor Person as Admin
    participant Browser
    participant Worker
    participant D1
    participant Telegram
    participant Cron

    Person->>Browser: click Ban user on the member page
    Browser-->>Person: dialog with a reason box, Ban user disabled while empty
    Person->>Browser: type reason, click Ban user
    Browser->>Worker: banUserFn(userId, reason)
    alt caller is not an admin
        Worker-->>Browser: error "Insufficient permissions"
    else target is the caller
        Worker-->>Browser: error "You cannot ban yourself"
    else reason empty or over 500 characters
        Worker-->>Browser: error "Give a reason for the ban" or<br/>"Keep the reason under 500 characters"
    else target not found
        Worker-->>Browser: error "User not found"
    else target is the master account
        Worker-->>Browser: error "The club account owns every album<br/>folder and cannot be banned."
    else already banned
        Worker-->>Browser: error "User is already banned"
    else allowed
        Worker->>D1: set banned_at, ban_reason, banned_by
        Worker->>D1: delete all sessions of the user
        Worker->>D1: flamekeeper row, start drain or mark drained
        Worker->>Telegram: ban message to the club channel
        Worker->>D1: cancel up to 3 booked bookings, revoke up to 10 folder accesses
        Worker-->>Browser: success
        Browser-->>Person: toast "Name was banned"
        Browser->>Browser: refresh all queries and the page data
    end
    alt call failed
        Browser-->>Person: toast with the error or "Failed to ban user"
    end
    Cron->>D1: finishBans repeats the cancel and revoke steps
    Note over Cron: see cron/flamekeepers/
```
