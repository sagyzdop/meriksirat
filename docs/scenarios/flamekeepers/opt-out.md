# Stop flamekeeping

> **Question:** What happens when a flamekeeper presses Stop flamekeeping?
>
> **Answer:** A confirmation dialog explains that new uploads stop at once and that photos not moved within 14 days are deleted. After confirming, a flamekeeper holding no photos becomes drained straight away and the app deletes its Drive access. One who holds photos goes into a 14-day draining state, receives an email, and moves the photos through the browser. A lost flamekeeper or one already drained is refused.
>
> **Notes:**
> - Draining ends when the last photo has moved. Then the state
>   becomes drained, usage is zeroed, and the stored Drive access
>   is revoked at Google and deleted.
> - Becoming drained also needs the person's empty album folders
>   released and no upload in flight. If that cannot finish yet,
>   the state is unchanged and the second toast is shown.
> - Already draining for opt_out or ban: pressing again changes
>   nothing and returns the current status. Draining for another
>   reason is switched to an opt_out drain with a fresh 14-day
>   deadline.
> - The moving itself is in relay-hand-out.md. The deadline and
>   reminders are handled by the clock, see cron/flamekeepers/.
> - The email says "Open your account page and keep the tab open
>   while the photos move. An admin may also move them for you."
> - A drained person can sign up again, see connect-drive.md.

```mermaid
sequenceDiagram
    autonumber
    actor F as Flamekeeper
    participant Browser
    participant Worker
    participant D1
    participant Cron
    F->>Browser: Press Stop flamekeeping
    Browser-->>F: Dialog "Stop flamekeeping?" with Keep going<br/>and Stop flamekeeping
    F->>Browser: Press Stop flamekeeping
    Browser->>Worker: optOutFlamekeeperFn()
    Worker->>D1: read flamekeeper row and check for photos
    alt No row
        Worker-->>Browser: error "You are not a flamekeeper"
    else State drained
        Worker-->>Browser: error "You have already stopped<br/>flamekeeping"
    else State lost
        Worker-->>Browser: error "Reconnect Drive first so your<br/>photos can be moved"
    else Already draining for opt_out or ban
        Worker-->>Browser: current status, nothing changed
    else No photos held
        Worker->>D1: state = drained, delete Drive access
        Worker-->>Browser: status drained
        Browser-->>F: Toast "You have stopped flamekeeping"
    else Photos held
        Worker->>D1: state = draining, reason opt_out,<br/>deadline = now + 14 days
        Worker->>Worker: email "#savenuimg: we are moving<br/>your photos"
        Worker-->>Browser: status draining
        Browser-->>F: Toast "Your photos are now moving to<br/>other flamekeepers"
    end
    Browser->>Browser: invalidate flamekeepers queries<br/>and reload the route
    Browser-->>F: On error, toast "Could not stop flamekeeping"<br/>or the server message
    Cron-->>F: see cron/flamekeepers/ for reminders and<br/>the deadline deletion
```
