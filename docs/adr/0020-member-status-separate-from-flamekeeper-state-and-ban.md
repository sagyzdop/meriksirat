# Member status is separate from flamekeeper state and from a ban

Member status is Active, Inactive or Alumni and describes club standing only.
Flamekeeper state (active, full, draining, lost, drained) is managed by the
system and is read-only for admins. A ban is account-wide: it overrides both in
admin listings (flamekeepers show Banned) and ends flamekeeping at once. None of
the three is derived from another, consistent with ADR-0011.
