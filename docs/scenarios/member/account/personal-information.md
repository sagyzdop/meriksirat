# Personal information

`/account` ("My Account") is open to members and non-members. Members get a Personal Information section and a read-only Club section (status, role, clearance, joined month). Non-members get the Club section with the join row, see [join club and onboarding](join-club-and-onboarding.md). A non-member who is a flamekeeper sees Graduating in the flamekeeper section instead.

## How does a member change their details?

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    M->>B: Edit one or more fields
    B-->>M: Save button becomes enabled
    M->>B: Click Save
    B->>B: Check each changed value with the shared profile schema
    alt A value is invalid
        B-->>M: Message under that field, nothing sent
    else All valid
        B->>W: updateUserProfileFn(changed fields only)
        W->>W: Graduation month goes through the pledge and 60-day rules
        W->>D: Update the user row
        opt Birthday changed
            W->>W: Refresh the birthdays calendar, failure only logged
        end
        W-->>B: Updated user
        B-->>M: Toast "Personal information saved", fields reload
    end
```

- Editable: first name, last name, birthday, major, graduation month, NU ID, Instagram. Email is locked.
- Names, NU ID, birthday and graduation month cannot be cleared. Major and Instagram can. A leading `@` on Instagram is dropped.
- A flamekeeper must enter a future graduation month. A nearer date follows the pledge rules in [flamekeeper account](../../flamekeeper/account/).

## How does a member link or relink Telegram?

```mermaid
sequenceDiagram
    autonumber
    participant M as Member
    participant B as Browser
    participant W as Worker
    participant D as D1
    participant T as Telegram
    M->>B: Click Link next to Telegram
    B->>W: getTelegramUpdateLinkUrlFn()
    W->>D: Reuse an unexpired link token or insert a new one (10 min)
    W-->>B: t.me bot link
    B-->>M: Opens the bot in a new tab, toast "Open Telegram and tap Start"
    M->>T: Tap Start
    T->>W: /start token (webhook)
    W->>D: Save telegramChatId and telegramUsername, delete the token
    W-->>T: "Telegram linked" and the main menu
```

- The Link button shows only while no Telegram username is saved. Until the bot saves it, the page keeps showing "Not linked" and does not refresh by itself.
- If the Telegram account has no username, the saved username stays unchanged.
- The bot side is in [link account](../telegram/link-account.md).
