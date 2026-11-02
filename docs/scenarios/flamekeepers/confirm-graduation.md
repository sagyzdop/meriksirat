# Confirm the graduation date

> **Question:** What happens when a flamekeeper answers the yearly "is this still your graduation date?" question?
>
> **Answer:** Pressing "Yes, it is right" saves the same pledge and date again and records the confirmation time, which starts a new 365-day wait. Pressing "Change date" opens the edit dialog instead. If the confirmed date is already under 60 days away, the same save that confirms it also starts the drain of all photos.
>
> **Notes:**
> - The question appears on the profile card once 365 days have
>   passed since the last confirmation (or since signing up if
>   there was none). It never appears for drained or lost
>   flamekeepers.
> - A reminder email for the same question is sent by the clock,
>   see cron/flamekeepers/ for when and how often.
> - Confirming sends the date stored in the row. A new date can
>   also be passed, but the button on the card does not send one.
> - Change date is the same flow as change-pledge.md.
> - The server only needs a signed-in flamekeeper row, so the call
>   also works for a draining flamekeeper.

```mermaid
sequenceDiagram
    autonumber
    actor F as Flamekeeper
    participant Browser
    participant Worker
    participant D1
    participant Cron
    Cron-->>F: see cron/flamekeepers/ for the<br/>reminder email
    F->>Browser: Press Yes, it is right
    Browser->>Worker: confirmGraduationFn()
    Worker->>D1: read flamekeeper row
    alt No row
        Worker-->>Browser: error "You are not a flamekeeper"
    else Row found
        Worker->>D1: save same pledge and date,<br/>graduationConfirmedAt = now
        opt Date is under 60 days away
            Worker->>D1: state = draining, deadline = now + 14 days<br/>(or drained at once if no photos)
        end
        Worker-->>Browser: success
        Browser->>Browser: invalidate flamekeepers queries<br/>and reload the route
        Browser-->>F: Toast "Graduation date confirmed"
    end
    Browser-->>F: On error, toast "Could not confirm the date"<br/>or the server message
    F->>Browser: Or press Change date
    Browser-->>F: Edit pledge dialog opens
```
