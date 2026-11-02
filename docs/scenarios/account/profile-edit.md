# Editing the profile

> **Question:** How does a member change their own details on
> the profile page?
>
> **Answer:** On `/profile` the member clicks "Edit Profile",
> changes fields and clicks "Save Changes". The changes are saved,
> the message "Profile updated successfully" appears, the form
> locks again and the page reloads its data. "Cancel" throws the
> edits away.
>
> **Notes:**
> - Editable: first name, last name, birthday, Instagram, major,
>   graduation year and NU ID. Email cannot be changed.
>   Status, role, clearance and Telegram are read-only here.
> - Only members see this form. Non-members see the account page
>   described in join-club.md and delete-account.md.
> - A changed birthday also refreshes the birthdays calendar. A
>   failure there is only logged.
> - Server rules: names must not be empty and graduation year
>   must be from 1900 to 2100. A failure shows the server's
>   message, or "Failed to update profile".
> - Changing the linked Telegram username is in
>   update-telegram.md.

```mermaid
sequenceDiagram
    autonumber
    participant P as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    P->>B: Click Edit Profile
    B-->>P: Fields unlocked, Cancel and Save Changes shown
    P->>B: Change fields, click Save Changes
    alt First or last name empty
        B-->>P: First name is required or Last name is required
    else Valid
        B-->>P: Button reads Saving...
        B->>W: updateUserProfileFn(changed fields)
        alt Not signed in or nothing to update
            W-->>B: Error Unauthorized or No valid fields<br/>provided for update
            B-->>P: Error toast with that message
        else Saved
            W->>D: Update the user row
            opt Birthday was sent
                W->>W: reconcileBirthdaysToCalendar
            end
            W->>D: Read the updated user row
            W-->>B: Updated user
            B-->>P: Toast Profile updated successfully
            B->>B: router.invalidate() reloads getUserFn
            B-->>P: Form locked with new values
        end
    end
```
