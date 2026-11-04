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
>   graduation month and NU ID. Email cannot be changed. Status,
>   role, clearance level and the other account facts sit on the
>   "Admin Managed" tab and cannot be changed here.
> - The Telegram username box is also locked. Its "Update
>   Telegram" button is in update-telegram.md.
> - Only members see this form. Non-members see the account page
>   described in join-club.md and delete-account.md.
> - When the form has a birthday, the birthdays calendar is
>   refreshed after saving. A failure there is only logged.
> - The server requires non-empty names and a graduation
>   month as a date. Anyone may enter a past month; a flamekeeper
>   must enter a future one, and a nearer date follows the 60-day
>   rule in change-pledge.md. A failure shows the server's message, or
>   "Failed to update profile".

```mermaid
sequenceDiagram
    autonumber
    participant P as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    P->>B: Click Edit Profile
    B-->>P: Fields unlocked, Cancel and Save Changes shown
    alt Cancel
        P->>B: Click Cancel
        B-->>P: Edits dropped, form locked
    else Save Changes
        P->>B: Change fields, click Save Changes
        alt First or last name empty
            B-->>P: First name is required or Last name is required
        else Valid
            B-->>P: Button reads Saving...
            B->>W: updateUserProfileFn(form fields)
            alt Not signed in or server refuses
                W-->>B: Error, for example Unauthorized
                B-->>P: Error toast with that message, or Failed to<br/>update profile
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
    end
```
