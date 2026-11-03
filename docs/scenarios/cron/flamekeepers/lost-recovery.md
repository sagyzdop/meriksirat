# How dropped photos come back after a flamekeeper reconnects

> **Question:** When a lost flamekeeper reconnects their Drive,
> how do their dropped photos and hidden albums return?
>
> **Answer:** Each run, checkFlamekeeperHealth looks at up to 2
> dropped volumes whose flamekeeper is active, full or draining
> again and not banned. For each one it either restores the
> volume or abandons it. Restoring turns up to 300 dropped
> photos per run back to live, brings back an album that was
> hidden because of the loss, and re-shares the folder if
> needed. Abandoning turns the dropped photos into deleted ones
> and removes the volume. A volume with more than 300 dropped
> photos takes several runs.
>
> **Notes:**
> - Abandon is chosen when the album was deleted for any reason
>   other than flamekeeper_lost, or when it is not pinned and
>   its expiry date has already passed. Otherwise the volume is
>   restored.
> - Re-sharing only happens when the volume has a folder, no
>   photo rows and no permission id. It uses the club account
>   token and costs 2 requests. If the budget cannot pay, the
>   loop stops. If the folder is gone in Drive (404), the volume
>   is abandoned. Any other error skips the volume until the
>   next run.
> - When a volume is fully restored, the flamekeeper's health
>   check time and cursor are cleared so the next probe audits
>   them again at once.
> - The reconnect itself happens in the app, see
>   ../../flamekeepers/drive-callback.md.
> - No message is sent to anyone when an album comes back.

```mermaid
sequenceDiagram
    autonumber
    participant Worker
    participant D1
    participant KV
    participant Drive

    Note over Worker: Last part of checkFlamekeeperHealth
    Worker->>D1: load up to 2 volumes with droppedAt set whose owner<br/>is not banned and in state active, full or draining
    loop each volume
        Worker->>Worker: planRecovery: restore or abandon
        opt restore and volume needs its folder shared again
            Worker->>Worker: take 2 requests, if not affordable stop
            Worker->>Drive: shareWithWriter with the club account token<br/>to the flamekeeper email
            alt folder not found (404)
                Worker->>Worker: switch to abandon
            else another error
                Worker->>Worker: log it and skip this volume until next run
            else shared
                Worker->>D1: save the new permissionId
            end
        end
        Worker->>D1: move up to 300 dropped photos to live (restore)<br/>or to deleted (abandon)
        opt restore and photos were moved
            Worker->>D1: raise usedBytes, recount the album<br/>if hidden for flamekeeper_lost bring it back<br/>and raise owner albumCount
            Worker->>KV: delete album:list:folder id and album:detail:album id
        end
        alt dropped photos still remain
            Worker->>Worker: leave the volume for the next run
        else restore
            Worker->>D1: set volume.droppedAt = null<br/>clear flamekeeper healthCheckedAt and healthCursor
        else abandon
            Worker->>D1: delete the volume row
        end
    end
```
