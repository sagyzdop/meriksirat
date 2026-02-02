# MerikSirat System Requirements

## Overview

A serverless, high-accountability equipment management system for the NU Image Photography Club. The system uses a web-first "Shopping Cart" model for booking photography gear, including unique items like specific SD cards. While the web interface is the primary platform for all management and operational tasks, a Telegram Bot serves as a secondary convenience layer for notifications, status checks, and quick-action handovers/returns.

## User Stories

### US-001: Google Authentication & Profile Onboarding (Web)

**As a** User
**I want to** sign in with any Google account and complete my profile
**So that** I am registered in the system with all necessary contact details for equipment accountability.

**Acceptance Criteria:**
WHEN user clicks "Sign in with Google"
THE SYSTEM SHALL authenticate via BetterAuth (accepting any valid Google email).

IF the user is authenticated but has an incomplete profile
THE SYSTEM SHALL redirect the user to a mandatory onboarding page.

WHEN on the onboarding page
THE SYSTEM SHALL require the user to provide: First Name, Last Name.
THE SYSTEM SHALL allow the user to optionally provide: Birthday.
THE SYSTEM SHALL require the user to link their Telegram account via deep link and automatically save Telegram ID and Username (@handle).

WHEN a user edits their profile after onboarding
THE SYSTEM SHALL allow updates to all fields except Google Email and Telegram Username.

IF the profile remains incomplete
THE SYSTEM SHALL block access to the booking and catalog features.

### US-002: Telegram Bot Linking (Web & Telegram)

**As a** User
**I want to** link my Telegram account to my web profile
**So that** I receive real-time alerts and can use the bot for convenience features.

**Acceptance Criteria (Web):**
WHEN a user clicks "Link Telegram" in their profile
THE SYSTEM SHALL generate a secure one-time token and provide a deep link to `t.me/Bot?start=TOKEN`.

**Acceptance Criteria (Telegram):**
WHEN the bot receives the `/start` command with a valid token
THE SYSTEM SHALL map the Telegram Chat ID to the User ID in D1 and send a "Connection Successful" message.

WHEN a user updates their Telegram username
THE SYSTEM SHALL update the username in the D1 database on next bot interaction.

### US-003: "Shopping Cart" Booking (Web)

**As a** User
**I want to** select multiple unique units and reserve them for specific times
**So that** I can secure the exact kit I need for a project.

**Acceptance Criteria (Web):**
WHEN user adds items to the cart
THE SYSTEM SHALL allow independent start and end times for each unit in the session.

WHEN user confirms the booking
THE SYSTEM SHALL verify availability across all individual unit Google Calendars using the `freeBusy` endpoint.

IF a conflict is found
THE SYSTEM SHALL reject the session and highlight the specific unit and time causing the overlap.

WHEN a booking is successful
THE SYSTEM SHALL create an event in each unit's Google Calendar with:
- Event title: `[Booking] [Equipment Model] - [User Name]`
- Description: Includes: User Name, Telegram Handle, Booking ID, User Event Details, and Global Equipment Admin Notes
WHEN a booking notification is sent
THE SYSTEM SHALL include the Global Equipment Admin Notes in the message.

### US-004: Catalog Browsing & Holder Transparency (Web)

**As a** User
**I want to** see gear availability and who is currently holding "In Use" items
**So that** I can coordinate handovers or plan future bookings.

**Acceptance Criteria (Web):**
WHEN user views the catalog
THE SYSTEM SHALL provide a toggle between a "Grid Card View" and a "Datatable List View."

WHEN in Datatable List View
THE SYSTEM SHALL provide filters by: Category, Status, and Current Holder.

IF an item is "In Use"
THE SYSTEM SHALL display a link to the holder's Telegram profile and the expected return time.

IF an item is "Pending Return"
THE SYSTEM SHALL display "Pending Return by Previous User" with the overdue time.

THE SYSTEM SHALL NOT drop the booking if the equipment is in "Pending Return by Previous User" state.

IF equipment is marked as 'Pending Return' during another user's booking time
THE SYSTEM SHALL prevent the next booking from starting until return is complete.

IF equipment remains 'Pending Return' for the entire duration of the next booking
THE SYSTEM SHALL mark the next booking as "Lost Due to Pending Return" while the previous booking remains "In Use" (overdue), and notify all affected users and the admin.

IF a user lacks specific permissions for high-end gear (Zonal Privacy)
THE SYSTEM SHALL hide those items from the catalog entirely.

### US-005: Equipment Handover (Web & Telegram)

**As a** User (Current Holder)
**I want to** transfer my responsibility for the gear directly to the next scheduled person via the Web Dashboard or a Telegram command
**So that** I do not have to return the gear to the physical locker and the next user can start their session immediately.

**Acceptance Criteria (Web UX):**
WHEN a user views their "Active Bookings" on the Web Dashboard
THE SYSTEM SHALL provide a "Handover Gear" button next to each item currently marked as "In Use."

WHEN the user clicks "Handover Gear"
THE SYSTEM SHALL display a list of upcoming bookings for that specific unit for the current day to suggest the most likely recipient.
THE SYSTEM SHALL also allow the user to search for any other registered club member by name or @username if no immediate booking is found.

WHEN a recipient is selected and the user clicks "Initiate Handover"
THE SYSTEM SHALL change the item status in D1 to "Pending Handover" and send an urgent notification (Telegram) to the recipient.

**Acceptance Criteria (Telegram UX):**
WHEN the user sends the `/handover` command
THE SYSTEM SHALL present an inline keyboard listing all unique units currently "In Use" by that user.

WHEN the user selects a unit
THE SYSTEM SHALL prompt: "Who are you handing this over to? Please reply with their @username or select from the list below." (The list shall show users with bookings for that item within the next 4 hours).

WHEN the recipient is identified
THE SYSTEM SHALL send a message to the recipient: "@UserA is attempting to hand over [Item Name] to you. Do you have the gear in your hands?"
THE SYSTEM SHALL provide an "Accept Handover" button to the recipient.

**The Handshake & Verification Logic:**
WHEN the recipient clicks "Accept Handover" (on Web or Telegram)
THE SYSTEM SHALL display a mandatory Checklist with admin-defined items: "By accepting, you confirm the following: 1. Glass is scratch-free, 2. Sensor is clean, 3. Battery is present, 4. No physical damage."

WHEN the recipient checks all boxes and clicks "Confirm & Take Responsibility"
THE SYSTEM SHALL update the original user's booking status to "Completed (Handover)" and the recipient's booking status to "In Use."
THE SYSTEM SHALL update the corresponding Google Calendar event title to: `[IN USE - @RecipientUsername]`.
THE SYSTEM SHALL send a final confirmation to both users: "Handover Complete. @RecipientUsername is now responsible for [Item Name]."

**Safety and Failure Logic:**
IF the recipient does not click "Confirm" within 15 minutes of the initiation
THE SYSTEM SHALL cancel the handover request, notify the original holder that the "Handover Timed Out," and keep the item under the original user's responsibility.

WHEN the original holder cancels the handover request before acceptance
THE SYSTEM SHALL revert the item status to "In Use" and notify the intended recipient.

IF the recipient clicks "Decline" or reports a "Issue Found" during the checklist
THE SYSTEM SHALL immediately flag the item as "Maintenance Required" in D1, block the Google Calendar, and alert the Super-Admin with the reporter's notes.

### US-006: Return with Photo Proof (Web & Telegram)

**As a** User
**I want to** officially end my booking by uploading a photo of the equipment via the Web or a specific Telegram command
**So that** I have a timestamped record of the gear's condition and my responsibility is cleared.

**Acceptance Criteria (Web UX):**
WHEN the user views their "Active Bookings" on the dashboard
THE SYSTEM SHALL provide an "End Booking" button.

WHEN the user clicks "End Booking"
THE SYSTEM SHALL present a multi-select list of all units in that session.

WHEN the user selects the items and uploads a photo
THE SYSTEM SHALL upload the image to Cloudflare R2 with filename format: `{timestamp}_{user_id}_{unit_id}.jpg`
THE SYSTEM SHALL update the status of selected items to "Returned" in D1.

**Acceptance Criteria (Telegram UX):**
WHEN the user sends the `/end_booking` command
THE SYSTEM SHALL fetch all units currently marked as "In Use" by that User ID.

IF the user has multiple items
THE SYSTEM SHALL present an inline keyboard allowing the user to select "All Items" or specific individual units.

WHEN items are selected
THE SYSTEM SHALL prompt: "Please send a photo of the equipment to confirm its condition."

WHEN the user sends the photo
THE SYSTEM SHALL upload the file to R2, link the URL to the D1 record, and send a confirmation: "Return logged. Summary sent to Admin."

THE SYSTEM SHALL then forward the photo in Telegram, also return details including R2 photo link to the Super-Admin's private Telegram chat through the bot.

### US-007: Partial Returns and Session Splitting (Web/Bot)

**As a** User
**I want to** return high-value gear (like a camera) while keeping specific accessories (like an SD card)
**So that** I can finish my digital workflow without blocking expensive hardware for other users.

**Acceptance Criteria:**
WHEN a user initiates a return (Web or Telegram) and selects only a subset of the session's items
THE SYSTEM SHALL treat this as a "Partial Return."

WHEN a Partial Return is submitted
THE SYSTEM SHALL immediately mark the returned units as "Available" in both D1 and Google Calendar.

IF the user chooses to keep remaining items (e.g., an SD card)
THE SYSTEM SHALL check the Google Calendar for conflicts in the immediate next 30 minutes.

IF no conflict exists
THE SYSTEM SHALL split the session and create a new 30-minute "Grace Period" booking for the remaining items.

IF a conflict exists (another user has booked the item)
THE SYSTEM SHALL block the partial return and notify the user: "Cannot keep [Item Name], it is reserved by another user in 15 minutes. Please return all gear."

WHILE an item is in a "Grace Period" session
THE SYSTEM SHALL send an urgent Telegram alert every 10 minutes until the final items are returned via the `/end_booking` flow.

WHEN a "Grace Period" booking overlaps with another user's booking
THE SYSTEM SHALL forcibly end the grace period and change the status to "Overdue."

### US-008: Booking Management & Extensions (Web & Telegram)

**As a** User
**I want to** manage my bookings and extend them when needed
**So that** I can adjust to changing project requirements.

**Acceptance Criteria:**
WHEN a user is within 15 minutes of their booking end time
THE SYSTEM SHALL present a "+30 mins" button in the Telegram bot.

WHEN the user clicks "+30 mins" WHILE no conflict exists in the Google Calendar
THE SYSTEM SHALL extend the GCal event and update the D1 record.

WHEN a user attempts to cancel or modify their booking before start time
THE SYSTEM SHALL allow the action and free the calendar slots.

WHEN a user modifies a booking before start time
THE SYSTEM SHALL allow adding/removing equipment items and changing times, subject to availability checks.

### US-009: Admin Equipment Management (Web)

**As a** Admin
**I want to** manage equipment inventory and categories
**So that** I can keep the system up-to-date with club gear.

**Acceptance Criteria:**
WHEN an Admin adds a new unit
THE SYSTEM SHALL require: Model Name, Category, Unique Serial Number/Unit ID, and the specific Google Calendar ID.
THE SYSTEM SHALL allow uploading of equipment images to R2 under `equipment-images/` prefix.

WHEN an Admin edits equipment categories
THE SYSTEM SHALL allow adding/removing categories (Cameras, Lenses, Tripods, SD Cards, Lights, Flashes).

WHEN an Admin toggles "Deactivate" on a unit
THE SYSTEM SHALL immediately hide it from the Catalog and cancel future bookings for that specific unit.

WHEN an Admin enables "Maintenance Mode"
THE SYSTEM SHALL provide options to disable ALL bookings or selective equipment only.

WHEN an Admin manages equipment
THE SYSTEM SHALL provide a "Global Equipment Notes" text field for rules applicable to all equipment.
THE SYSTEM SHALL display these notes in booking notifications and calendar event descriptions.

### US-010: Admin Maintenance Tools (Web)

**As a** Admin
**I want to** access comprehensive maintenance tools for calendar cleanup, database management, and user administration
**So that** I can keep the system running smoothly and perform administrative tasks efficiently.

**Acceptance Criteria:**
WHEN an Admin accesses the Maintenance Dashboard
THE SYSTEM SHALL provide the following tools:

1. **Calendar Cleanup Tool (Should be available from Bookings tab):**
   - Provide options to: Delete single events, Delete events in bulk, Archive events by moving to a separate "Archive" calendar
2. **Database Maintenance:**
   - Provide "Export Database" button that creates downloadable CSV/JSON files of all data
   - Provide "Backup Database" button that creates timestamped snapshot to R2
   - Provide "Restore from Backup" functionality with version selection
   - Display database size statistics and cleanup recommendations
3. **User Management Tools (Should be available from Users tab):**
   - Allow bulk user actions: Deactivate/Reactivate multiple users, Clearance level updates, Role changes
   - Show user statistics: Total users, Active users, Users with overdue incidents
   - Allow export of user lists with booking history

---

## Functional Requirements

### FR-001: Unit-Level Identity

**Priority:** P0
**Persona:** Admin
THE SYSTEM SHALL treat every physical unit (e.g., "SD Card Unit 4") as a unique database entity with a dedicated Google Calendar ID.
**Rationale:** Necessary to prevent concurrency conflicts on identical-looking but physical different items.

### FR-002: Availability Source of Truth

**Priority:** P0
**Persona:** User
THE SYSTEM SHALL treat the Google Calendar API as the authoritative source for availability.
**Rationale:** To ensure manual admin blocks on the calendar are instantly reflected in the web app.

### FR-003: Pickup Confirmation Window

**Priority:** P1
**Persona:** User

WHEN a booking session is within 30 minutes of its start time
THE SYSTEM SHALL display a "Confirm Pickup" button on the user's web dashboard and Telegram bot.

WHEN the "Confirm Pickup" button is clicked
THE SYSTEM SHALL update the unit status to "In Use" in the D1 database and update the Google Calendar event title.

IF the equipment is currently "In Use" by another user when the booking starts
THE SYSTEM SHALL display: "Equipment currently in use by @username. Please coordinate handover." with the current holder's Telegram contact.

### FR-004: Datatable Management

**Priority:** P2
**Persona:** Admin
WHEN an Admin views the "All Bookings" or "User List" page
THE SYSTEM SHALL utilize a datatable with sorting, filtering, and a CSV export capability for auditing.

### FR-005: Timezone Integrity

**Priority:** P0
**Persona:** System
THE SYSTEM SHALL process all inputs and display all timestamps in the `Asia/Almaty` (UTC+5) timezone.
THE SYSTEM SHALL store all timestamps as UTC in the database.

### FR-006: Ghosting Prevention (Auto-Cancellation)

**Priority:** P0
**Persona:** User / Admin
WHEN a booking reaches its start time
THE SYSTEM SHALL enter the "Awaiting Pickup" state.

IF the user fails to click "Confirm Pickup" (on Web or Bot) within 20 minutes
THE SYSTEM SHALL send a final warning via Telegram and a Web notification.

IF the user fails to click "Confirm Pickup" within 30 minutes
THE SYSTEM SHALL automatically cancel the booking, DELETE the Google Calendar event, and log a "No-Show" against the user's profile.

### FR-007: The Handshake/Pickup Checklist

**Priority:** P1
**Persona:** User
WHILE a user is confirming a Pickup or Handover
THE SYSTEM SHALL display an admin-defined checklist (e.g., "Glass is clean," "Battery is charged," "SD card present").
**Rationale:** To ensure the user physically inspects the gear before accepting legal/financial responsibility.

### FR-008: Telegram Quick-Commands (Convenience Layer)

**Priority:** P1
**Persona:** User
WHEN a user types `/status` in the bot
THE SYSTEM SHALL return a real-time list of all units, their current holder, and expected return times.

WHEN a user interacts with the bot
THE SYSTEM SHALL provide both command-based interaction and a persistent menu for common actions.

### FR-009: Overdue Alerts & Public Feed

**Priority:** P2
**Persona:** All Members
WHEN a booking is 30 minutes past its end-time without a Return or Handover action
THE SYSTEM SHALL post an alert to the "Club Feed" Telegram channel identifying the overdue user and the specific items.

### FR-010: Admin Inventory Control

**Priority:** P1
**Persona:** Admin
WHEN an Admin adds a new unit
THE SYSTEM SHALL require a Model Name, Category, Unique Serial Number/Unit ID, and the specific Google Calendar ID.
THE SYSTEM SHALL provide a toggle to "Deactivate" a unit, which immediately hides it from the Catalog and cancels future bookings for that specific unit.

### FR-011: User Tiering (Zonal Privacy Logic)

**Priority:** P1
**Persona:** Admin
THE SYSTEM SHALL allow Admins to assign a "Clearance Level" to users and a "Required Level" to equipment models.
IF a user's Clearance Level is lower than the Equipment's Required Level
THE SYSTEM SHALL exclude those items from the user's Catalog view and search results.

### FR-012: Booking Policy Enforcement

**Priority:** P1
**Persona:** User
THE SYSTEM SHALL enforce a maximum booking duration (default: 24 hours, admin-editable) and a maximum lead time (default: 2 weeks in advance, admin-editable).
IF a user attempts to exceed these limits in the Shopping Cart
THE SYSTEM SHALL block the checkout and display the specific policy violation.

### FR-013: Telegram Webhook Implementation

**Priority:** P0
**Persona:** System
THE SYSTEM SHALL use Telegram Webhooks (not long-polling) for bot communication.
THE SYSTEM SHALL support channels for club feed notifications and private chats for user interactions.

### FR-014: Photo Storage & Management

**Priority:** P1
**Persona:** System
WHEN a return photo is uploaded
THE SYSTEM SHALL store it in Cloudflare R2 with filename format: `{timestamp}_{user_id}_{unit_id}.jpg`
THE SYSTEM SHALL accept JPEG, PNG, and WebP formats up to 10MB.
THE SYSTEM SHALL use private buckets with signed URLs that expire after 24 hours.

### FR-015: Grace Period Management

**Priority:** P1
**Persona:** User
WHEN a user is in a "Grace Period" session
THE SYSTEM SHALL allow unlimited extensions via "+30 mins" button as long as no conflicts exist.
THE SYSTEM SHALL automatically transition to "Overdue" status when grace period overlaps with another booking.

### FR-016: Google Calendar Event Retention

**Priority:** P1
**Persona:** Admin

WHEN a booking is returned normally
THE SYSTEM SHALL update the Google Calendar event title to append `[RETURNED - @username]`
THE SYSTEM SHALL update the event description to include the R2 photo URL and return timestamp.

WHEN an Admin uses the Calendar Cleanup Tool
THE SYSTEM SHALL require explicit confirmation before deleting any events.
THE SYSTEM SHALL maintain an audit log of all calendar cleanup actions.

**Rationale:** Historical event data is valuable for analytics and dispute resolution.

### FR-017: Database Backup & Export

**Priority:** P2
**Persona:** Admin

WHEN an Admin initiates a database export
THE SYSTEM SHALL generate downloadable files in CSV and JSON formats for all major tables.

WHEN an Admin creates a database backup
THE SYSTEM SHALL store a timestamped snapshot in R2 under `backups/database/{timestamp}.json`
THE SYSTEM SHALL retain the 10 most recent backups automatically.

**Rationale:** Data safety and administrative flexibility for audits or migrations.

### FR-018: Bulk User Management

**Priority:** P2
**Persona:** Admin

WHEN an Admin performs bulk user actions
THE SYSTEM SHALL show a preview of changes before confirmation.
THE SYSTEM SHALL provide undo functionality for bulk actions within 24 hours.

WHEN importing users via CSV
THE SYSTEM SHALL validate required fields and skip invalid rows with error reporting.

**Rationale:** Efficient administration for club leadership changes or batch updates.

---

## Non-Functional Requirements

### NFR-001: Performance (Serverless Latency)

THE SYSTEM SHALL respond to UI actions within 300ms (excluding cold-start and external Google API latency).

### NFR-002: Timezone Consistency

THE SYSTEM SHALL process all booking times in the `Asia/Almaty` (UTC+5) timezone for display while storing as UTC.

### NFR-003: Accessibility

THE SYSTEM SHALL be fully responsive and optimized for mobile devices using React Router with Shadcn UI/Tailwind.

### NFR-004: Rate Limiting

THE SYSTEM SHALL implement rate limiting on all API endpoints (100 requests per 5 minutes per IP) to stay within Cloudflare Free Tier CPU limits.

### NFR-005: Mobile-First UX

WHILE the system is "Web-First," THE SYSTEM SHALL prioritize a "Mobile-First" design for the Booking Dashboard, as pickups and returns happen physically on-site.

### NFR-006: Telegram Bot UX

THE SYSTEM SHALL provide both command-based interaction and a persistent menu in the Telegram bot for optimal user experience.

---

## Data Requirements

### DR-001: User Persistence

THE SYSTEM SHALL store: UserID, GoogleEmail, FullName, TelegramChatID, TelegramUsername, Role, PermissionLevel, and ClearanceLevel.

### DR-002: Equipment Persistence

THE SYSTEM SHALL store: UnitID, ModelName, Description, CategoryID, GCalID, RequiredClearanceLevel, Status, and ImageURL.

### DR-003: Booking Persistence

THE SYSTEM SHALL store: BookingID, UserID, EquipmentID, SessionID, StartTime, EndTime, Status, OriginalBookingID (for splits), and HandoverToUserID.

### DR-004: Status Calculation & Storage

THE SYSTEM SHALL compute equipment display status in real-time based on booking data, not store it persistently.
Equipment display statuses shall be: `available`, `reserved`, `in_use`, `pending_return`, `maintenance`.

THE SYSTEM SHALL store booking status with values: `reserved`, `awaiting_pickup`, `in_use`, `pending_handover`, `returned`, `cancelled`, `overdue`, `grace_period`, `lost_due_to_pending_return`.

### DR-005: Photo Storage & Archiving

THE SYSTEM SHALL store all return photos in **Cloudflare R2** with private access and signed URLs.
THE SYSTEM SHALL retain return photos for 60 days via an R2 Lifecycle Policy, after which they are automatically deleted.
THE SYSTEM SHALL store equipment images in separate R2 prefix (`equipment-images/`) with no automatic deletion.
WHEN a return photo is uploaded
THE SYSTEM SHALL forward it to the Super-Admin's private Telegram chat for archival purposes.

### DR-006: Audit Logs

THE SYSTEM SHALL store a log of all Handover events, including the timestamps and IDs of both the Giver and Receiver.
THE SYSTEM SHALL log all No-Show incidents for admin review.

### DR-007: Category Management

THE SYSTEM SHALL store equipment categories in a separate table allowing admin CRUD operations.

### DR-008: Global Equipment Notes

THE SYSTEM SHALL store global equipment notes in a dedicated table, editable only by admins.
THE SYSTEM SHALL include these notes in all booking notifications and calendar event descriptions.

---

## Integration Requirements

### IR-001: Cloudflare Full-Stack React Router + Hono Template

THE SYSTEM SHALL be built using the `cloudflare/react-router-hono-fullstack-template` as the base with React Router frontend and Hono backend.
THE SYSTEM SHALL use file-based routing in `src/routes/` for API endpoints and React Router for client-side routing.
THE SYSTEM SHALL utilize Shadcn UI components for consistent user interface.
THE SYSTEM SHALL implement server-side rendering (SSR) where appropriate for performance.

### IR-002: Google Calendar API (The Availability Engine)

THE SYSTEM SHALL use the Google Calendar API with OAuth scopes: `calendar.events`, `calendar.freebusy`, `calendar.readonly`.
THE SYSTEM SHALL use Google Calendar as the authoritative source for gear availability.
WHEN a booking is confirmed, THE SYSTEM SHALL create an event in the unit's calendar.
WHILE a unit is "In Use," THE SYSTEM SHALL append `[IN USE - @username]` to the calendar event title.

### IR-003: Telegram Bot API (Notification & Quick-Action Layer)

THE SYSTEM SHALL use Telegram Webhooks to handle notifications and convenience commands.
WHEN a return is completed, THE SYSTEM SHALL forward the R2 photo link to the Super-Admin for instant review.
THE SYSTEM SHALL support channels for public alerts and private chats for user interactions.

### IR-004: Cloudflare Cron Triggers (State Monitor)

THE SYSTEM SHALL run a Cron Job every 5 minutes to check for upcoming bookings, overdue gear, and ghosting sessions.

### IR-005: BetterAuth Integration

THE SYSTEM SHALL integrate BetterAuth for Google OAuth authentication accepting any valid Google email domain.

### IR-006: Drizzle ORM Database Management

THE SYSTEM SHALL use Drizzle ORM as the primary database abstraction layer.
THE SYSTEM SHALL define all database schemas using Drizzle schema definitions.
THE SYSTEM SHALL use Drizzle migrations for database version control.

---

## Constraints

- **Technical Constraint:** THE SYSTEM SHALL be hosted on Cloudflare Workers (Free Tier).
- **Technical Constraint:** THE SYSTEM SHALL use Telegram Webhooks (not long-polling) for bot implementation.
- **Business Constraint:** Users must provide Name, Surname, and Telegram handle before booking gear.
- **Business Constraint:** Google Calendar event descriptions MUST include: User Name, Telegram Handle, Booking ID, Global Equipment Admin Notes, and User Event Details.
- **Business Constraint:** Telegram account linking is mandatory during initial onboarding.
- **Operational Constraint:** Extensions are only permitted if no subsequent booking exists within the requested window.
- **Operational Constraint:** Maximum booking duration default is 24 hours (admin-editable).
- **Operational Constraint:** Maximum lead time default is 2 weeks (admin-editable).

## Out of Scope

- Automatic penalties for overdue incidents
- Manual review of return photos
- Customizable handover checklists per equipment type
- Email notifications (Telegram only for MVP)
- Automated daily database backups (Manual tools provided instead)
- Error reporting to Telegram admin channel
- Automated calendar cleanup (Manual tools provided instead)
- Automatic handling of "Lost Due to Pending Return" incidents (admin will handle manually)

## Success Metrics

| Metric                | Target | Measurement                                         |
| --------------------- | ------ | --------------------------------------------------- |
| Return Compliance     | 100%   | % of bookings with a corresponding R2 photo         |
| Ghosting Reduction    | < 5%   | Number of auto-cancelled bookings vs Total Bookings |
| Handover Success      | > 90%  | % of initiated handovers completed successfully     |
| Equipment Utilization | > 60%  | % of time equipment is in use vs available          |
