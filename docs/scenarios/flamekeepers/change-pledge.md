# Change the pledge or graduation date

> **Question:** What happens when a flamekeeper edits their pledge or expected graduation month?
>
> **Answer:** The Edit button on the pledge row opens a dialog for the pledge. It sends the pledge and the graduation month already stored to the server (the month itself is changed in the Graduating field, see ../account/profile-edit.md), which saves them. A graduation date under 60 days away ends flamekeeping at once (Drive access deleted, state drained), because nothing is held on a flamekeeper. The pledge never causes anything to move. The dialog closes with a toast and the My Account page refreshes.
>
> **Notes:**
> - The new values are always saved, even when flamekeeping ends.
>   Saving also counts as confirming the graduation date.
> - The old pledge-below-usage drain and graduation drain were
>   removed in #24 (last `dev` commit containing them:
>   `2565826`).
> - The server also rejects a pledge that is not 512 MB, 1, 2, 3, 4 or
>   5 GB, with the message "Choose one of the pledge options".
> - A drained flamekeeper cannot edit and must sign up again, see
>   connect-drive.md. A lost flamekeeper can still edit.
> - The date is stored once, on the user, not on the flamekeeper. Changing it in the Graduating field follows the same 60-day rule as this dialog.
> - A graduation date that is unchanged is not re-checked for
>   being in the future.
> - After saving, account data is reloaded, see profile-card.md.

```mermaid
sequenceDiagram
    autonumber
    actor F as Flamekeeper
    participant Browser
    participant Worker
    participant D1
    F->>Browser: Press Edit, change the pledge, press Save
    alt Pledge not one of the six options
        Browser-->>F: Toast "Choose how much you can lend."
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
            opt Date is 60 days away or less
                Worker->>D1: state = drained, delete Drive access
            end
            Worker-->>Browser: success
            Browser->>Browser: invalidate flamekeepers queries<br/>and reload the route
            Browser-->>F: Toast "Flamekeeper settings updated"
        end
    end
    Browser-->>F: A server error shows as a toast, fallback<br/>"Update failed"
```
