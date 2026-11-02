# One-time notice that albums are now public

> **Question:** How do owners of existing albums get told their
> albums became public?
>
> **Answer:** Migration 0026 marked every album that was not
> deleted and was not already shared with a pending-notice time.
> Each tick the notifyPublicAlbums step finds albums with that mark,
> groups them by owner, and sends each owner one Telegram message
> listing their albums. After the message is sent, or when the owner
> has no Telegram, the mark is cleared. A failed send keeps the mark
> so the next tick retries.
>
> **Notes:**
> - One album: Your album "TITLE" is now public and listed in the
>   gallery. Anyone with the link could already open its Drive
>   folder, so nothing else changes. A link follows.
> - Several albums: N of your albums are now public and listed in
>   the gallery, then up to 10 titles, "and N more" if over 10,
>   then the same Drive sentence in plural.
> - At most 5 owners are messaged per tick, 1 request each. Owners
>   are taken oldest mark first. Owners with no Telegram cost
>   nothing and do not count toward the 5.
> - Without a bot token nothing is cleared and the step logs
>   "TELEGRAM_BOT_TOKEN not configured, leaving public album
>   notices pending".
> - The migration also removed the old is_shared column.
> - After every pending album is cleared, the step does nothing.

```mermaid
sequenceDiagram
    autonumber
    participant Cron
    participant Worker
    participant D1
    participant Telegram
    Cron->>Worker: notifyPublicAlbums, runPublicAlbumNotices(env, budget)
    Worker->>D1: albums where publicNoticePendingAt is set<br/>and deletedAt is null, oldest first
    alt none pending
        Worker-->>Cron: step ends
    else no bot token
        Worker->>Worker: warn and leave all pending
    else pending albums
        Worker->>Worker: group albums by owner
        loop each owner
            alt owner has no telegramChatId
                Worker->>D1: publicNoticePendingAt = null for their albums
            else 5 owners done, or budget cannot afford 1
                Worker->>Worker: stop for this tick
            else
                Worker->>Telegram: sendMessage(chatId, buildPublicNoticeText)
                alt send failed
                    Worker->>Worker: log error, keep the mark
                else sent
                    Worker->>D1: publicNoticePendingAt = null for their albums
                end
            end
        end
    end
```
