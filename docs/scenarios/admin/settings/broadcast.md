# Broadcast message

Admins can send a Telegram message to every user with a linked chat. Reached from Dashboard, Quick Actions, Broadcast Message, and from Settings, Members. Managers do not see it.

## How is a broadcast composed and delivered?

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant B as Browser
    participant W as Worker
    participant TG as Telegram
    A->>B: write message (1-4000 characters), Next
    B-->>A: confirm step
    A->>B: send
    loop chunks of 20 recipients until done
        B->>W: broadcastTelegramMessageFn(message, offset)
        W->>TG: send message plus "— sender name" to each linked chat
        W-->>B: sent, failed, skipped, done
        B-->>A: progress bar
    end
    W->>TG: summary "Broadcast sent to N user(s)" to the club channel
    B-->>A: Broadcast Complete with totals
```

- Users without a linked chat are skipped and counted. Link status is shown on the dashboard Members tab and as an alert.
- The browser drives the chunking because one Worker invocation cannot deliver a whole broadcast within Telegram rate limits and the subrequest budget. A failed chunk request shows "Broadcast failed"; failures inside a chunk are only counted.
- The club-channel summary is posted once, when the last chunk finishes.
