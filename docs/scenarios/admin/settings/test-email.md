# Test email

## How does an admin check that the app can send email?

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant W as Worker
    participant G as Gmail send
    A->>W: Dashboard header, Send test email
    W->>G: send "nu_image test email" to the admin's own address
    alt sent
        W-->>A: toast "Test email sent to <address>"
    else failed
        W-->>A: toast "Failed to send test email. Check the server logs."
    end
```

Admin only. The recipient is always the signed-in admin, never a chosen address. Flamekeeper reconnect and graduation emails use the same sender ([account card](../../flamekeeper/account/account-card.md)).
