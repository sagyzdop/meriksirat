# Deleting your own account

> **Question:** Can a person delete their account, and what
> happens when they do?
>
> **Answer:** Only a non-member who is not currently flamekeeping
> can. They see a "Delete account" card on `/profile`, click
> "Delete my account" and confirm "Delete your account?". The
> account and its favorites are removed for good and the browser
> goes to `/`, which redirects to `/albums`. Club members cannot
> delete themselves.
>
> **Notes:**
> - A flamekeeper whose state is "drained" counts as no longer
>   flamekeeping and may delete. Any other state blocks it.
> - The card is hidden when the rule says no, and the server
>   checks the same rule again.
> - Opening `/profile` also loads the flamekeeper record. For a
>   flamekeeper whose photos are still moving away, that load
>   finishes the move if no photos are left, which can make the
>   card appear.
> - Deleting the user row also removes sessions, linked Google
>   accounts, Telegram tokens, favorites and the flamekeeper row
>   through database cascades.
> - Nothing else deletes an account. Accounts are never removed
>   for being unfinished.

```mermaid
sequenceDiagram
    autonumber
    participant P as Non-member
    participant B as Browser
    participant W as Worker
    participant D as D1
    P->>B: Open /profile
    B->>W: getUserFn()
    W-->>B: User
    B->>W: getMyFlamekeeperFn()
    W-->>B: Flamekeeper record or none
    opt canDeleteAccount is true
        B-->>P: Delete account card
        P->>B: Click Delete my account
        B-->>P: Dialog Delete your account? This removes your<br/>account and your favorites. It cannot be undone.
        alt Cancel
            P->>B: Click Cancel
            B-->>P: Dialog closes
        else Delete account
            P->>B: Click Delete account
            B-->>P: Button reads Deleting...
            B->>W: deleteMyAccountFn()
            W->>D: Read isMember, email, flamekeeper.state
            alt Member or still flamekeeping
                W-->>B: Error Club members keep their account.<br/>Other accounts can be deleted once any flamekeeping<br/>has stopped and the photos have moved.
                B-->>P: Error toast with that message, or Could not<br/>delete the account
            else Allowed
                W->>D: Delete the user row (cascades)
                W-->>B: success
                B-->>P: Browser loads / and lands on /albums
            end
        end
    end
```
