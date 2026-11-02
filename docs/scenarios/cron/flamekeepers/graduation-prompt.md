# How flamekeepers are asked to confirm their graduation date

> **Question:** When does a flamekeeper get an email asking them
> to check their graduation date?
>
> **Answer:** A year after they last confirmed the date (or
> after they became a flamekeeper, if they never confirmed),
> graduateFlamekeepers emails them once to ask whether the
> expected graduation date is still right. Up to 2 such emails
> go out per run, 1 request each. Flamekeepers who are draining,
> drained or lost get none, and nobody who just had a drain
> started in the same run. Ignoring the email changes nothing by
> itself.
>
> **Notes:**
> - The year is 365 days from graduationConfirmedAt, which is
>   set when the flamekeeper saves their pledge and date in the
>   app.
> - Only one email is sent per year: the send time is stored and
>   a new one is due only after the next anniversary.
> - Subject: #savenuimg: is your graduation date still right?
>   Body: the saved date, a note that photos are moved 60 days
>   before it, a request to confirm or change it, and a link to
>   the account page.
> - If the email fails to send, nothing is stored and it is
>   tried again next run.
> - What happens when the date is near is in
>   graduation-trigger.md.

```mermaid
sequenceDiagram
    autonumber
    participant Worker
    participant D1
    participant Gmail
    participant Member as Flamekeeper

    Note over Worker: Second half of graduateFlamekeepers
    loop each loaded flamekeeper until 2 prompts sent
        Worker->>Worker: skip if a drain was just started for them
        Worker->>Worker: graduationPromptEmailDue: not drained, lost or draining,<br/>365 days since confirmation, no prompt since then
        opt prompt is due
            Worker->>Worker: take 1 request, if not affordable stop
            Worker->>Gmail: sendEmail with the club account token:<br/>#35;savenuimg: is your graduation date still right?
            alt email sent
                Gmail-->>Member: please confirm or change the date
                Worker->>D1: set graduationPromptSentAt = now
            else send failed
                Worker->>Worker: log the error, retry next run
            end
        end
    end
```
