# Admin Route Gate

> **Question:** Who gets into the admin area, and what stops everyone else?
>
> **Answer:** Only a signed-in club member whose role is admin or manager can open any page under /admin. Everyone else is redirected to sign in, onboarding or the profile page, or sees "Page not found". The page check is only the first lock. Every admin server function checks the caller's role again against the database and refuses with a short error if the role is missing.
>
> **Notes:**
>
> - The role is read from the database on every server call, not from the browser, so a role change takes effect on the next click.
> - A banned person's sessions are deleted when the session is looked up, so they are treated as signed out.
> - The sidebar shows the Admin group only to admins and managers. Typing an /admin address by hand still hits the same gate.
> - Which of the two roles may call which function is in [who-can-do-what.md](who-can-do-what.md).

```mermaid
sequenceDiagram
    autonumber
    actor Person as Person
    participant Browser
    participant Worker
    participant D1

    Person->>Browser: open an /admin page
    Browser->>Worker: getUserFn()
    Worker->>D1: look up session and user row
    Note over Worker,D1: a banned user has sessions<br/>deleted and counts as signed out
    Worker-->>Browser: profile or null
    alt no profile
        Browser-->>Person: redirect to /login
    else still needs onboarding
        Browser-->>Person: redirect to /onboarding
    else not a club member
        Browser-->>Person: redirect to /account
    else role is not admin or manager
        Note over Browser: console warning is logged
        Browser-->>Person: error "Page not found"
    else role is admin or manager
        Browser-->>Person: admin page renders
    end
    Person->>Browser: click any admin action
    Browser->>Worker: any admin server function
    Worker->>D1: checkAdminPermission reads role again
    alt no session
        Worker-->>Browser: error "Unauthorized: No session"
    else user row missing
        Worker-->>Browser: error "Unauthorized: User not found"
    else role not in the allowed list
        Note over Worker: warning logged with user id,<br/>email and role
        Worker-->>Browser: error "Insufficient permissions"
    else allowed
        Worker-->>Browser: function runs and returns
    end
```
