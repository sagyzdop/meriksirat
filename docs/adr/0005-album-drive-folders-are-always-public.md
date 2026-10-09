# Album folders are always public in Google Drive

Every album is a Drive folder in the club's shared master Google account, and
creating an album immediately grants the folder Drive's "anyone reader"
permission — permanently. Photos are then served straight from Google's CDN with
no Worker and no per-request access check. The app's `is_shared` flag only decides
whether the album's view link works in the app; it never revokes Drive access. We
accepted that albums cannot be truly private through the app in exchange for free,
unmetered image delivery.
