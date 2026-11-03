# Change A Member's Role, Status Or Clearance

> **Question:** What happens when an admin or manager changes a member's role, status or clearance level in the Members table?
>
> **Answer:** Each dropdown saves as soon as a value is picked. The server updates that one field and the table reloads with a toast "User updated". Making someone a manager or admin is allowed only for an admin, and only for a club member. Setting the status to Inactive also signs the person out everywhere. Any status change also refreshes the birthdays calendar.
>
> **Notes:**
> - The Manager and Admin options are greyed out for managers. The server refuses the same change if it is sent by hand, see [who-can-do-what.md](who-can-do-what.md).
> - Only the fields sent are changed. A call with nothing to change is refused with "No valid fields provided for update".
> - Birthdays use only the Active and Board statuses, so a status change can add or remove the member's birthday event. A failure of that sync is logged and does not undo the change, see [sync-birthdays.md](sync-birthdays.md).
> - A person set to Inactive is also refused at the next sign-in. The sign-in side is in [../account/sign-in.md](../account/sign-in.md).
> - First name and last name can also be changed by this function, but this table does not offer them.
> - The clearance dropdown offers levels 1 to 10. A manager can also set a role back to User, even for an admin.

```mermaid
sequenceDiagram
    autonumber
    actor Person as Admin or Manager
    participant Browser
    participant Worker
    participant D1
    participant Calendar

    Person->>Browser: pick a value in Role, Status or Clearance
    Browser->>Worker: updateUserAdminFn(userId, field)
    Worker->>D1: read target user
    alt target not found
        Worker-->>Browser: error "User not found"
    else role admin or manager and target is not a member
        Worker-->>Browser: error "Only club members can be<br/>assigned the manager or admin role."
    else role admin or manager and caller is a manager
        Worker-->>Browser: error "Insufficient permissions to assign<br/>admin or manager roles. Only admins<br/>can assign these roles."
    else no field to change
        Worker-->>Browser: error "No valid fields provided for update"
    else allowed
        Worker->>D1: update the field
        opt status was changed
            Worker->>Calendar: reconcile birthday events, master token
            Note over Worker,Calendar: failure is logged only
            opt new status is Inactive
                Worker->>D1: delete all sessions of the user
            end
        end
        Worker-->>Browser: updated user
        Browser->>Browser: refresh all users queries
        Browser-->>Person: toast "User updated"
    end
    alt any error above
        Browser-->>Person: toast "Failed to update user" with the reason
    end
```
