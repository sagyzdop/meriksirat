# Multi-step conversations through the text router

> **Question:** How does the bot continue a conversation when a
> member taps a button or types text in the middle of a flow?
>
> **Answer:** The bot keeps one saved step per chat in KV
> (`session:CHATID`, expires after 1 hour). `handleFlowText` reads
> it and sends the text to the matching step. With no saved step
> the text shows the main menu. If the member is no longer linked
> in a step that needs an account, the main menu is usually shown.
>
> **Notes:**
> - The 8 steps are `awaiting_booking_selection`,
>   `awaiting_item_selection`, `awaiting_photo`,
>   `awaiting_start_selection`, `awaiting_start_confirm`,
>   `awaiting_cancel_selection`, `awaiting_cancel_items` and
>   `awaiting_cancel_confirm`.
> - Steps that show the main menu when the chat is not linked:
>   `awaiting_start_selection` (after a valid booking button),
>   `awaiting_start_confirm`, `awaiting_item_selection`,
>   `awaiting_cancel_items` and `awaiting_cancel_confirm`. Picking
>   a booking at `awaiting_booking_selection` or
>   `awaiting_cancel_selection` gives "Please link your account
>   via /start first." instead.
> - `awaiting_photo` has no text handling. Text sent then falls to
>   the main menu (default branch). Only a photo moves it on.
> - Saving a step again restarts the 1 hour expiry. Nothing deletes
>   a session explicitly.
> - Unlike the list commands, `handleFlowText` has no error catch,
>   so a thrown error ends the update with 500 (see `webhook.md`).
> - Each step is detailed in the file named on its arrow.

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Worker
    participant KV
    participant D1
    participant Telegram
    Member->>Worker: text that is not a command or button<br/>handleFlowText(ctx)
    Worker->>KV: get session:chatId
    alt no session or no step
        Worker->>Telegram: showMainMenu(ctx)
    else session found
        Worker->>D1: getLinkedUserId(ctx, chatId)
        alt step awaiting_start_selection
            Worker->>Worker: pick booking, see start-booking.md
        else step awaiting_start_confirm
            Worker->>Worker: Confirm or Cancel,<br/>see start-booking-confirm.md
        else step awaiting_booking_selection
            Worker->>Worker: pick booking to return,<br/>see return-equipment.md
        else step awaiting_item_selection
            Worker->>Worker: pick items to return,<br/>see return-equipment.md
        else step awaiting_cancel_selection
            Worker->>Worker: pick booking to cancel,<br/>see cancel-booking.md
        else step awaiting_cancel_items or awaiting_cancel_confirm
            Worker->>Worker: pick items or confirm,<br/>see cancel-confirm.md
        else step awaiting_photo or unknown step
            Worker->>Telegram: showMainMenu(ctx)
        end
    end
    Telegram-->>Member: reply with the next keyboard
```
