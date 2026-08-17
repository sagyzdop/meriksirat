# Telegram Bot

The Telegram bot is the primary interface for managing active bookings —
starting pickups, returning equipment, and cancelling unneeded bookings. It
also sends all booking notifications.

## Linking Your Account

1. Go to your **Profile** page in the web app.
2. Click the Telegram link to open a chat with the bot.
3. The bot will confirm your account is linked.

If your Telegram isn't linked, the onboarding process will guide you through
it. In development mode, this step is automatically skipped.

## Bot Menu

The bot uses an inline keyboard menu (not slash commands). After linking, you
see four options:

### My Bookings

Shows a summary of your active and upcoming bookings with equipment names,
time slots, and per-item statuses.

### Start Booking

Lists bookings within the 15-minute start window. Select a booking and
confirm to mark it as picked up. The actual pickup time is recorded.

### End Booking

Lists bookings with `active` or `overdue` items. Select a booking, choose
which items to return (or "Return All"), then send a photo of the equipment.
The return is logged and admins receive the photo.

### Cancel Booking

Lists bookings with `booked` items (never picked up). Select items to cancel,
or cancel all. A confirmation step prevents accidental cancellations.

## Notifications

The bot sends these automatically:

| Notification         | When                                             |
| -------------------- | ------------------------------------------------ |
| Booking reminder     | ~15 min before start time                        |
| Start time warning   | At start time (booking still `booked`)           |
| Return warning       | At end time (items not returned)                 |
| Grace period warning | 5 min before grace period ends                   |
| Overdue alert        | When items become overdue (15 min past end time) |
| Auto-cancel          | When a booking is cancelled for no-show          |

## Restrictions

- **Start Booking** only appears for bookings within ±15 minutes of start time.
- **End Booking** only shows `active` or `overdue` items.
- **Cancel Booking** only shows `booked` items — once equipment is picked up,
  it must be returned through the normal flow.
