# Admin And Manager Permissions

> **Question:** Which admin actions can a manager do, and which are only for admins?
>
> **Answer:** Managers can do day-to-day running of the club: dashboard, Club Members (members, birthdays, violations), Equipment (equipment and categories), settings and exports. Admins can do all of that plus the actions that reach every member or change who gets in: broadcast, test email, club code, free-space expiry, bans, and assigning the manager or admin role. A manager who tries an admin-only call gets "Insufficient permissions". The buttons for those actions are hidden or disabled for managers, so the error appears only if the call is made by hand.
>
> **Notes:**
>
> - Only club members can hold the manager or admin role. The check applies to admins as well.
> - Setting someone's role back to Member is allowed for managers. Only the two elevated roles are blocked.
> - The flamekeeper pool cap is admin only. Its screen is in [../flamekeepers/admin-pool.md](../flamekeepers/admin-pool.md) and booking oversight is in [../bookings/admin-bookings-list.md](../bookings/admin-bookings-list.md).
> - The gate that runs before all of this is in [route-gate.md](route-gate.md).

```mermaid
sequenceDiagram
    autonumber
    actor Manager as Manager
    actor Admin as Admin
    participant Browser
    participant Worker

    Note over Manager,Worker: Both roles may call these<br/>getAdminDashboardStatsFn, getAdminDashboardAlertsFn<br/>getAdminMostActiveUsersFn, getViolationsFn<br/>getAdminUserAlbumsFn, exportUsersFn, exportAlbumsFn<br/>getSettingsFn, updateSettingsFn, getPoolOverviewFn<br/>getUpcomingBirthdaysFn, syncBirthdaysToCalendarFn<br/>five category functions, seven equipment functions<br/>getAdminUsersFn, getAdminUserByIdFn<br/>updateUserAdminFn, bulkUpdateUserClearanceFn<br/>resetUserViolationCountersFn
    Manager->>Browser: open dashboard Settings tab
    Note over Browser: club code card is not shown
    Manager->>Browser: open Quick Actions menu
    Note over Browser: no Broadcast Message item<br/>no Send test email button
    Manager->>Browser: open dashboard Albums tab
    Note over Browser: no Free up space panel
    Manager->>Browser: open a member page
    Note over Browser: no Ban section
    Manager->>Browser: open Role dropdown on Members
    Note over Browser: Manager and Admin options<br/>are disabled
    Manager->>Worker: updateUserAdminFn(role = admin) by hand
    alt target is not a club member
        Worker-->>Manager: error "Only club members can be<br/>assigned the manager or admin role."
    else caller is a manager
        Worker-->>Manager: error "Insufficient permissions to assign<br/>admin or manager roles. Only admins<br/>can assign these roles."
    end
    Manager->>Worker: admin-only function by hand
    Worker-->>Manager: error "Insufficient permissions"
    Note over Admin,Worker: Admin only<br/>getClubCodeFn, rotateClubCodeFn<br/>broadcastTelegramMessageFn, sendTestEmailFn<br/>getDeletionSuggestionsFn, expireAlbumNowFn<br/>banUserFn, unbanUserFn, setFlamekeeperCapFn
    Admin->>Worker: any function above
    Worker-->>Admin: runs
```
