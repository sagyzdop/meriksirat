# #savenuimg: storing albums in members' Google Drive (feasibility research)

Researched 2026-11-01 against primary sources (Google developer docs, Google Workspace Admin Help, Google Cloud Help, Drive Help, better-auth docs/source). Every claim has a citation. Anything not confirmed from a primary source is marked **UNVERIFIED**. Context: [ADR 0005](../adr/0005-album-drive-folders-are-always-public.md), `src/lib/google/google-drive.ts`, `src/lib/auth/auth.ts`.

## TL;DR

- **Technically feasible with `drive.file` only.** `drive.file` is **non-sensitive** [S1]. It covers files the app creates. It is accepted by `files.create`, `files.copy` and `about.get` [S1][S3][S4], and Google says it "works with all Drive API REST Resources" [S1]. With an offline refresh token, the app can create album folders in a flamekeeper's My Drive, upload into them, set "anyone with link" permissions and later read or delete them, with no user present. The new files are owned by the flamekeeper and use their quota [S9]. Non-sensitive scopes avoid the unverified-app screen, the 100-user cap and CASA [S7][S8].
- **Migrating existing albums is the hard part.** Under `drive.file`, the app can only touch a file that is authorized for *that user*. Otherwise the API returns `appNotAuthorizedToFile` [S12]. Club-owned files are not authorized for the flamekeeper, so a server-side `files.copy` into their Drive most likely fails unless the flamekeeper selects the files in the Picker (**UNVERIFIED**, test it). The other options are downloading and re-uploading (bandwidth through the Worker), or using the full `drive` scope. `drive` is **restricted** and needs restricted-scope verification plus an annual CASA assessment [S1][S6].
- **Ownership transfer only works inside the org.** A Workspace (work/school) account can transfer ownership only to users in the same organization, and no acceptance is needed. It cannot transfer to gmail accounts or to other orgs [S5][S14]. The `pendingOwner` accept flow is for consumer accounts only [S2]. So nu_image → flamekeeper@nu.edu.kz works, but transfers to gmail or to a separate alumni org do not.
- **Big economic catch.** NU members' storage comes from **one pooled org quota**, and the admin sets per-user caps on top [S15][S16]. Moving files from nu_image to an NU student's account only moves usage from one cap to another inside the same NU pool. It is real headroom only because the club account itself is capped, and it does not grow NU's total. Only non-NU accounts (gmail with 15 GB free) add new storage, and those cannot receive ownership transfers.
- **Lifecycle risk is high.** If a flamekeeper's account is deleted, their files go with it once the 20-day restore window ends, unless an admin transfers them first [S17]. The club cannot do that transfer itself. Suspension hides the files from the user but keeps the data [S18]. A rename or domain change keeps the data [S19]. NU's alumni procedure (rename to alumni.nu.edu.kz vs. a new account in a separate org) is **UNVERIFIED**.
- **Verification cost.** With `drive.file` only: brand verification (homepage, privacy policy, domain ownership) and no security assessment [S7]. With `drive`: restricted-scope review plus annual CASA [S6]. Google charges no fee; the developer pays the lab directly [S20]. Lab prices are not published (**UNVERIFIED**); the free self-scan path was not confirmed. An "Internal" consent screen avoids verification, but only for users in the project's own Cloud Organization [S7][S8].
- **Policy fit.** The Drive API ToS says "Using Drive as a replacement for a large-scale content delivery network (CDN) is not allowed" [S21]. The current single-account design (ADR 0005) already sits close to that line, and spreading albums across many accounts does not change it. The Google Photos Library API is not an alternative: since 2025-03-31 it can only access app-created content, and sharing/shared-album methods are gone [S22].

## 1. Scopes

| Scope | Allows | Class |
|---|---|---|
| `drive.file` | "Create new Drive files, or modify existing files, that you open with an app or that the user shares with an app while using the Google Picker API or the app's file picker." Per-file access. | Non-sensitive [S1] |
| `drive.appdata` | "View and manage the app's own configuration data in your Google Drive" (hidden app folder, not user-visible; unusable for public albums) | Non-sensitive [S1] |
| `drive` | "View and manage all your Drive files." | Restricted [S1] |
| `drive.readonly`, `drive.metadata`, `drive.metadata.readonly` | read all / metadata | Restricted [S1] |

- Restricted Drive scopes are allowed only for backup/sync, productivity/education, and reporting/security apps. Storing or transmitting restricted-scope data server-side requires a security assessment [S1].
- `files.copy` accepts `drive`, `drive.appdata`, `drive.file` or `drive.photos.readonly` [S3]. `about.get` accepts `drive.file` among others [S4].
- With `access_type=offline`, Google returns a refresh token so the app "can refresh access tokens when the user is not present" [S10]. Refresh tokens stop working when access is revoked, after 6 months unused, when there are more than 100 live tokens per account per client (the oldest is silently invalidated), when an admin restricts the scope's service (`admin_policy_enforced`), or when time-based access expires [S11].
- Under `drive.file`, a file the app didn't create or open returns `appNotAuthorizedToFile`. The fix is the Picker, "Open with", or checking `isAppAuthorized` [S12].
- Link-shared files may need a `resourceKey` sent in the `X-Goog-Drive-Resource-Keys` header [S13].
- **UNVERIFIED:** whether `drive.file` authorization is strictly per-user. Specifically, can user B's token reach a file that user A created through the same OAuth client? Expect no. Test it before designing migration around it.
- **UNVERIFIED (no explicit doc sentence):** that `permissions.create` with `type=anyone` works on app-created files under `drive.file`. It follows from "works with all Drive API REST Resources" [S1] but should be tested.

## 2. Verification, user types, incremental auth, better-auth

- **All production apps need brand verification:** homepage on an owned domain, privacy policy, Search Console domain verification [S7].
- **Sensitive and restricted scopes add:** an appropriate use case, a demo video, Limited Use compliance and narrowest-scope justification. Restricted scopes also require an **annual security assessment** by a Google-empanelled assessor [S7][S6].
- **CASA:** it is the last step of restricted review, at assurance level AL1 or AL2 chosen by Google, revalidated yearly [S6][S20b]. Google charges nothing, and the developer pays the authorized lab directly [S20]. Lab prices are **UNVERIFIED** (not published).
- **Exemptions** [S8]:
  - Personal use (<100 users, who click through warnings).
  - Internal use: "only used by people in your Google Workspace or Cloud Identity". The project must be owned by the org and the consent screen set to Internal.
  - Admin-trusted apps.
  - Marketplace admin install.
  - Dev/testing mode (still has the unverified screen and the 100-user cap).
- **Internal user type:** only members of the project's Google Cloud Organization can authorize [S7a].
  - If alumni.nu.edu.kz is a secondary domain in the same NU Workspace org, alumni are covered. If it is a separate org, they are not (**UNVERIFIED** for NU).
  - Gmail accounts are never covered.
  - Whether the club's GCP project sits inside NU's Cloud Organization is **UNVERIFIED**; it likely needs NU IT.
- **Unverified-app screen and cap:** the screen appears only for sensitive or restricted scopes. The cap is "100 new users in total", lifetime, and cannot be reset [S9a][S7a].
- **Testing mode:** limited to 100 test users. External + Testing refresh tokens expire after 7 days unless only basic profile scopes are requested [S7a][S11].
- **Workspace admin controls:** NU admins can allow any unconfigured app (the default), allow only basic sign-in, or block unconfigured apps. Configured apps can be Trusted, Limited (unrestricted services only), Specific scopes, or Blocked. Education orgs have separate under-18 rules [S23]. NU's current setting is **UNVERIFIED**, and NU could block the feature at any time.
- **Incremental authorization:** `include_granted_scopes=true` lets one client add scopes "in context", so only flamekeepers are asked for Drive [S10]. With granular consent, users may grant only some scopes, so the app must check which scopes it actually got [S10].
- **better-auth (repo uses ^1.6.25):**
  - `authClient.linkSocial({ provider: 'google', scopes: ['https://www.googleapis.com/auth/drive.file'] })` "triggers a new OAuth flow that requests the additional scopes while maintaining the existing account connection" (≥1.2.7).
  - `additionalParams: { access_type: 'offline', prompt: 'consent' }` can be passed per call, or `accessType: 'offline'` plus `prompt: 'select_account consent'` can be set on the provider [S24].
  - The current config sets only `prompt: 'select_account'`, with no offline access (`src/lib/auth/auth.ts`).
  - `auth.api.getAccessToken({ body: { accountId } })` refreshes expired tokens through the stored refresh token. "A trusted server call can also provide `userId` when it does not include session headers", which fits cron or background work [S24][S25].
  - The account table already stores `scope`, `refresh_token` and `access_token_expires_at` (`src/db/schema.ts`).

## 3. Ownership transfer

- **Workspace:**
  - Transfers are allowed only "to someone in your organization". No acceptance is needed. You can only transfer to someone the file is already shared with [S14].
  - Through the API: a permission with `role=owner` (or update to it with `transferOwnership=true`), after which the previous owner becomes `writer` [S2].
  - Transferring a folder does not transfer the files inside it [S14].
- **Consumer:** the `pendingOwner=true` + `role=writer` flow emails the prospective owner, who accepts by setting `role=owner` + `transferOwnership=true` [S2]. A personal account can't transfer to a work/school account [S14].
- **Accepting via the API:** the acceptance is an API call made *as the prospective owner* [S2]. An app holding that user's token could in principle make it, but under `drive.file` the file isn't authorized for that user's app (**UNVERIFIED**). There is no documented way for a third party to accept on a user's behalf.
- **Workspace to personal account:** not possible. "Google doesn't support direct transfer of ownership to or from an external account" [S26].
- **Admin data transfer tool:** within the org only. The recipient must be active, have enough storage and have Drive on. It moves My Drive files and folders into a transfer folder. Trash is not moved [S26].
- **Shared drives and service accounts:** no ownership transfers in shared drives. Transfers to service accounts fail because they have no quota [S2].

## 4. Quota accounting, copy semantics, limits

- **Owner pays:** "Files in shared folders only consume the cloud storage quota of the original file owner, never the recipient." The exception: if you "make a copy of a shared file or add your own files into a folder someone shares with you," those use **your** storage [S9][S27].
- **Effect on the Worker design:** uploads must be created with the **flamekeeper's** token to charge their quota. Uploading with the club master token into a flamekeeper's folder would still charge the club.
- **`files.copy`:** "Creates a copy of a file" and returns a new File with a **new ID** [S3]. The copy is owned by and charged to the copier [S9]. Copies count toward the 750 GB/day upload limit [S28]. Server-side, no-download copying is implied by the API shape but not stated explicitly (**UNVERIFIED** wording).
- **Cross-domain copy:** copying an "anyone with link" file across domains works with a resource key if needed [S13]. Under `drive.file` it is blocked unless the file is authorized (see §1).
- **Folders:** copying a folder is not documented [S3]; treat folders as non-copyable and recreate the tree (**UNVERIFIED**).
- **Limits** [S28][S12]:
  - 750 GB/day upload+copy per user.
  - Max upload 5 TB per file; max copy file size 750 GB.
  - 500 M items per account (`activeItemCreationLimitExceeded`).

## 5. Shared drives and pooled storage

- **Pooled storage:** shared drive content counts toward the org's pooled storage. A shared drive with no limit is "limited only by the total pooled storage for your organization" [S29][S30]. External members don't add storage; the pool is the owning org's (**UNVERIFIED** explicit sentence, implied by [S29]).
- **Education pool:** Education Fundamentals/Standard get 100 TB pooled, plus 20 GB per Plus license and 100 GB per Teaching & Learning license. More can be bought in 10 TB steps [S15].
- **Per-user and per-shared-drive caps:** admins set per-user limits by OU or group (group overrides OU) and can set separate shared-drive limits [S16][S29].
- **At the limit:** a user over their limit can't add or create files, but can still view and download [S16]. If the org exceeds its pool by 25% or for 14 days, uploads are blocked org-wide [S30].
- **Possible no-code path:** asking NU IT for a larger cap on the club account, or a configuration group for it (for example "500 GB for a Photographers group" [S16]), may solve the problem with zero engineering.

## 6. `about.get` storageQuota

- **Scope:** `drive.file` is sufficient [S4].
- **Fields** [S4a]:
  - `limit`: absent if unlimited. **For pooled-storage orgs it is the org limit, not the user's.**
  - `usage`: all services; org-wide when pooled.
  - `usageInDrive` and `usageInDriveTrash`.
- **Implication:** for NU accounts, `about.get` may not report the admin-set 20 GB per-user cap (**UNVERIFIED**, test with a real NU account). Free-space math may be wrong, so treat `storageQuotaExceeded` [S12] as the real signal.

## 7. Account lifecycle and over-quota

- **Rename/domain change:** done "without losing any of their data". The old address becomes an alias, and sign-in moves to the new address [S19]. Drive file IDs and links should survive (**UNVERIFIED**, not stated).
- **Suspension:** Drive is unavailable to the user, and collaborators "retain their ability to view, edit, and collaborate" [S18]. Whether public "anyone" links keep serving is **UNVERIFIED**. Effect on OAuth tokens is **UNVERIFIED**.
- **Deletion:** an admin can restore a deleted user for 20 days. Files not transferred before then are gone, and Trash is never transferred [S17].
- **NU alumni process** (rename into alumni.nu.edu.kz vs. a new account; separate org or not; the ~500 MB cap): **UNVERIFIED**. No official nu.edu.kz page was found; ask NU IT or alumni@nu.edu.kz.
- **Over quota:**
  - Workspace: can't upload or create, can still view [S16].
  - Consumer: can't upload. "All of your content… may be removed" after 2 years over quota, with at least 3 months' notice [S27].

## 8. API usage limits and IDs

- **Per-minute quotas:** 1,000,000 quota units/min per project and 325,000/min per user per project. Requests per day are unlimited within the per-minute limits [S28].
  - Cost per call: read 5 units, list 100, create/update/copy/delete/permission changes 50, download 200.
  - 1 TB/day egress per project before charges.
  - This unit model applies to projects created on or after 2026-05-01. Older active projects keep their previous quotas [S28].
- **Errors:** 403 `userRateLimitExceeded` or 429. Use exponential backoff with jitter [S28][S12].
- **IDs change:** copying creates a new file with a new ID [S3]. Every image link and DB `driveFileId` must be rewritten after migration. Ownership transfer keeps the same file, so the ID is unchanged (**UNVERIFIED**, implied by [S2]).

## 9. Policy and alternatives

- **User Data Policy, Limited Use:** use data only to provide or improve user-facing features, no transfers or sales, and no human reading except listed exceptions. Users must be told before data use changes. Applies to all apps, verified or not [S31][S8].
- **No CDN use:** "Using Drive as a replacement for a large-scale content delivery network (CDN) is not allowed" [S21]. The Workspace Service Terms also say Drive "is not intended for use as a content distribution network" [S32]. Drive web hosting was deprecated in 2015 [S33]. Serving public album images from members' Drives is the same pattern ADR 0005 already relies on. Risk grows with traffic; no explicit threshold is published (**UNVERIFIED**).
- **Not for backups:** the Drive API ToS also disallows "Backup of user or app content from a developer's app or project to Drive" [S21]. Framing the feature as "archival backup of club albums into members' Drives" could fall under this; framing matters (**UNVERIFIED** interpretation).
- **Google Photos:** removed scopes are `photoslibrary.readonly`, `photoslibrary.sharing` and `photoslibrary`. The remaining scopes are `appendonly`, `readonly.appcreateddata` and `edit.appcreateddata`. Sharing and shared-album methods return 403 after 2025-03-31 [S22]. There is no public-link album serving, so Photos is not viable.

## Open questions / unverified

1. Is `drive.file` authorization per-user? Can user B's token `files.copy` a club-owned "anyone with link" file without the Picker? Expected: no (`appNotAuthorizedToFile`). Prototype it.
2. After an in-org ownership transfer from nu_image to a flamekeeper, can the app (holding the flamekeeper's `drive.file` token) access the file?
3. Does `about.get` on an NU account show the per-user cap or the org pool?
4. NU Workspace facts:
   - Is alumni.nu.edu.kz in the same org?
   - What are the alumni procedure and cap?
   - What is the third-party app access policy for unconfigured apps?
   - Is the GCP project inside NU's Cloud Organization (needed for Internal)?
   - Would NU simply raise nu_image's cap or create a club shared drive?
5. CASA lab cost and the availability of the free self-scan tier.
6. Do public links of suspended or renamed users keep working?
7. Is a server-side `files.copy` charged against the 750 GB/day of the copier? Yes per [S28]. Does it consume egress? Unknown.

## Sources

- [S1] Choose Google Drive API scopes: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- [S2] Transfer file ownership: https://developers.google.com/workspace/drive/api/guides/transfer-file
- [S3] files.copy: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy
- [S4] about.get: https://developers.google.com/workspace/drive/api/reference/rest/v3/about/get
- [S4a] About resource: https://developers.google.com/workspace/drive/api/reference/rest/v3/about
- [S5] = [S14]
- [S6] Security assessment: https://support.google.com/cloud/answer/13465431
- [S7] Verification requirements: https://support.google.com/cloud/answer/13464321
- [S7a] Audience / user type / publishing status: https://support.google.com/cloud/answer/15549945
- [S8] When verification is not needed: https://support.google.com/cloud/answer/13464323
- [S9] How your Google storage works: https://support.google.com/docs/answer/9312312
- [S9a] Unverified apps: https://support.google.com/cloud/answer/7454865
- [S10] OAuth 2.0 for web server apps: https://developers.google.com/identity/protocols/oauth2/web-server
- [S11] OAuth 2.0 overview (refresh token expiration): https://developers.google.com/identity/protocols/oauth2
- [S12] Drive API resolve errors: https://developers.google.com/workspace/drive/api/guides/handle-errors
- [S13] Resource keys: https://developers.google.com/workspace/drive/api/guides/resource-keys
- [S14] Drive Help, transfer ownership: https://support.google.com/drive/answer/2494892
- [S15] Education storage overview: https://support.google.com/a/answer/10403871
- [S16] Set storage limits for users: https://knowledge.workspace.google.com/admin/storage/set-storage-limits-for-your-users
- [S17] Delete a user / restore: https://knowledge.workspace.google.com/admin/users/delete-or-remove-a-user-from-your-organization and https://support.google.com/a/answer/1397578
- [S18] Suspend a user: https://knowledge.workspace.google.com/admin/users/suspend-a-user-temporarily
- [S19] Change a user's name or email: https://knowledge.workspace.google.com/admin/users/overview-changing-a-directory-users-name-or-email-address
- [S20] OAuth verification FAQ (assessment fees): https://support.google.com/cloud/answer/13463817 ; CASA assessors: https://appdefensealliance.dev/casa/casa-assessors
- [S20b] CASA assurance levels: https://appdefensealliance.dev/casa/casa-tiering
- [S21] Drive API Terms of Service: https://developers.google.com/workspace/drive/api/terms
- [S22] Google Photos API updates: https://developers.google.com/photos/support/updates
- [S23] Control which apps access Workspace data: https://knowledge.workspace.google.com/admin/apps/control-which-apps-access-google-workspace-data
- [S24] better-auth OAuth concepts / Google provider: https://github.com/better-auth/better-auth/blob/main/docs/content/docs/concepts/oauth.mdx , https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/google.mdx
- [S25] better-auth getValidAccessToken source: https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/api/routes/account.ts
- [S26] Admin transfer of Drive files: https://knowledge.workspace.google.com/admin/drive/transfer-drive-files-to-a-new-owner-as-an-admin
- [S27] = [S9] (over-quota policy)
- [S28] Drive API usage limits: https://developers.google.com/workspace/drive/api/guides/limits
- [S29] Storage limits for shared drives: https://knowledge.workspace.google.com/admin/storage/set-storage-limits-for-shared-drives
- [S30] Workspace storage FAQ for admins: https://knowledge.workspace.google.com/admin/storage/google-workspace-storage-faq-for-admins
- [S31] Google API Services User Data Policy: https://developers.google.com/terms/api-services-user-data-policy
- [S32] Workspace Service Specific Terms: https://workspace.google.com/terms/service-terms/
- [S33] Deprecating web hosting in Drive (2015): https://workspaceupdates.googleblog.com/2015/08/deprecating-web-hosting-support-in.html
