# Change the pledge or graduation date

> **Question:** What happens when a flamekeeper edits their pledge or expected graduation date?
>
> **Answer:** The edit dialog sends both values to the server, which saves them and works out whether the flamekeeper must start moving photos, may resume normal state, or can carry on unchanged. Lowering the pledge below what is already stored starts a 14-day drain of the excess. A graduation date under 60 days away starts a drain of everything. Raising the pledge above usage returns a full or pledge-draining flamekeeper to normal. The dialog closes with a toast and the profile refreshes.
>
> **Notes:**
> - The new values are always saved, even when a drain starts.
>   Saving also counts as confirming the graduation date.
> - When a drain starts, an email "#savenuimg: we are moving your
>   photos" is sent to the flamekeeper with the amount, the reason
>   and the deadline.
> - The server also rejects a pledge outside 1 to 1024 GB, with
>   the message "Pledge at least 1 GB" or "Pledge at most 1024 GB".
> - A drained flamekeeper cannot edit and must sign up again, see
>   connect-drive.md.
> - A graduation date that is unchanged is not re-checked for
>   being in the future.
> - After saving, profile data is reloaded, see profile-card.md.

```mermaid
sequenceDiagram
    autonumber
    actor F as Flamekeeper
    participant Browser
    participant Worker
    participant D1
    F->>Browser: Press Edit pledge, change values, press Save
    alt Pledge outside 1 to 1024 GB
        Browser-->>F: Toast "Pledge at least 1 GB"
    else Pledge valid
        Browser->>Worker: updateFlamekeeperFn(pledgeGb,<br/>graduationDate)
        Worker->>D1: read flamekeeper row
        alt No row
            Worker-->>Browser: error "You are not a flamekeeper"
        else State is drained
            Worker-->>Browser: error "Sign up again to resume<br/>flamekeeping"
        else Date changed and not in the future
            Worker-->>Browser: error "Expected graduation date must<br/>be in the future"
        else Accepted
            Worker->>D1: save pledge, date, confirmed time
            alt Drain must start
                Worker->>D1: state = draining, deadline = now + 14 days
                Worker->>Worker: email "#savenuimg: we are moving<br/>your photos"
            else Drain no longer needed, or full with room
                Worker->>D1: state = active, clear drain fields
            end
            Worker-->>Browser: success
            Browser->>Browser: invalidate flamekeepers queries<br/>and reload the route
            Browser-->>F: Toast "Flamekeeper settings updated"
        end
    end
    Browser-->>F: Any error shows as a toast, fallback<br/>"Update failed"
```
