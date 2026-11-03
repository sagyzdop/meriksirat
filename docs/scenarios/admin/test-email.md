# Send A Test Email

> **Question:** How does an admin check that the club can send email?
>
> **Answer:** The admin opens Send test email on the dashboard. The server sends a short message to the admin's own address and the page shows a toast naming that address. If the email service reports a failure, the toast says to check the server logs.
>
> **Notes:**
> - The button is shown to admins only. A manager who calls the function gets "Insufficient permissions".
> - The message goes only to the person who pressed the button, never to other members. It is sent through Gmail from the club master account.
> - The subject is "nu_image test email" and the body states the time it was sent.

```mermaid
sequenceDiagram
    autonumber
    actor Person as Admin
    participant Browser
    participant Worker
    participant D1
    participant Gmail

    Person->>Browser: click Send test email
    Browser-->>Person: button shows "Sending..."
    Browser->>Worker: sendTestEmailFn()
    Worker->>D1: check caller is an admin
    alt not an admin
        Worker-->>Browser: error "Insufficient permissions"
        Browser-->>Person: toast with the error
    else admin
        Worker->>Gmail: send test email to the admin<br/>with the master account token
        alt email service reports failure
            Worker-->>Browser: error "Failed to send test email.<br/>Check the server logs."
            Browser-->>Person: toast with that error
        else sent
            Worker-->>Browser: sentTo
            Browser-->>Person: toast "Test email sent to address"
        end
    end
```
