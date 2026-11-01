# Signup is NU-only, and NU accounts start by connecting Drive

The club needs storage more than it needs open signup, so there is now one
signup flow instead of a choice between "member" and "flamekeeper". New accounts
must be `@nu.edu.kz` or `@alumni.nu.edu.kz`; every other domain is refused before
a user row is created. An `@nu.edu.kz` account pledges at least 1 GB and connects
Drive to finish signup. An alumni account has about 500 MB, so it skips Drive and
gets a plain account that can favorite photos. Anyone can enter the club code at
any time to become a member, which adds the profile and Telegram steps. An `@nu.edu.kz`
account that isn't a member, has no Drive connected and owns nothing is deleted
after 7 days; alumni accounts are never deleted this way, because they can't
connect Drive and admins list them on their own tab.

The check runs only when an account is created, not at each sign-in. Google's
hosted-domain restriction was rejected because it applies to every sign-in and
would lock out existing Gmail members and graduates. Existing users are
grandfathered: they keep working and are prompted to connect Drive, because a
lockout would stop bookings overnight. Connecting Drive is required only at
signup. Opting out stays possible, and graduates end up `drained` with their
account and favorites intact, so "everyone has Drive connected" is never an
invariant the code can rely on.

This supersedes the part of ADR-0010 that keeps membership open to any Google
account, and the part of ADR-0011 where users pick a path at signup. ADR-0010's
rule that flamekeepers must be `@nu.edu.kz` still holds, and membership and
flamekeeping remain separate capabilities.
