# Club Settings

> **Question:** How does an admin or manager change the booking note, the birthdays calendar or the daily opening hours?
>
> **Answer:** On the dashboard Settings tab the person edits the global booking note, the birthdays calendar ID and the start and end of the daily booking window, then presses Save Settings. The form refuses to save when either time is empty or the start is not before the end. On success a toast says "Settings updated successfully" and the dashboard and booking data reload.
>
> **Notes:**
> - The settings are one shared row. If it does not exist yet, opening the tab creates it with an empty note and hours 00:00 to 23:59.
> - Times are stored as minutes after midnight, from 0 to 1439. The preview line under the form shows the bookable hours and the number of 30-minute slots per day.
> - Only the fields sent are changed. The server repeats the start-before-end check and refuses with "Operating hours start must be before end time".
> - The club code lives in the same row but is never returned by getSettingsFn. See [club-code.md](club-code.md).
> - An empty birthdays calendar ID falls back to the built-in default calendar when birthdays are synced, see [sync-birthdays.md](sync-birthdays.md).

```mermaid
sequenceDiagram
    autonumber
    actor Person as Admin or Manager
    participant Browser
    participant Worker
    participant D1

    Person->>Browser: open the Settings tab
    Browser->>Worker: getSettingsFn()
    Worker->>D1: read settings row global
    opt row missing
        Worker->>D1: insert row with empty note, hours 0 to 1439
    end
    Worker-->>Browser: settings without the club code
    Person->>Browser: edit fields and click Save Settings
    alt a time is empty
        Browser-->>Person: "Both operating hours times are required"
    else start is not before end
        Browser-->>Person: "Start time must be before end time"
    else form is valid
        Browser->>Worker: updateSettingsFn(note, calendarId, start, end)
        alt start is not before end on the server
            Worker-->>Browser: error "Operating hours start must be before end time"
            Browser-->>Person: toast with that error
        else saved
            Worker->>D1: update only the fields sent
            Worker-->>Browser: updated row
            Browser-->>Person: toast "Settings updated successfully"
            Browser->>Browser: refresh admin-dashboard and bookings queries
        end
    end
```
