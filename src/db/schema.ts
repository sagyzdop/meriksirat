import { relations, sql } from 'drizzle-orm'
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/sqlite-core'

export const user = sqliteTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('email_verified', { mode: 'boolean' })
      .default(false)
      .notNull(),
    image: text('image'),
    // Telegram fields
    telegramChatId: text('telegram_chat_id'),
    telegramUsername: text('telegram_username'),
    // Onboarding fields
    instagramUsername: text('instagram_username'),
    googleId: text('google_id').unique(),
    nuId: integer('nu_id').unique(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    birthday: text('birthday'),
    wantsBirthdayCongratulation: integer('wants_birthday_congratulation', {
      mode: 'boolean',
    }).default(true),
    major: text('major'),
    graduationDate: text('graduation_date'),
    status: text('status', {
      enum: [
        'Active',
        'Inactive',
        'On Probation',
        'Board',
        'Ex-Board',
        'Roommate',
        'Ex-Roommate',
        'Graduated',
      ],
    }).default('Active'),
    clearanceLevel: integer('clearance_level').default(1),
    role: text('role', { enum: ['user', 'manager', 'admin'] }).default('user'),
    isMember: integer('is_member', { mode: 'boolean' })
      .default(false)
      .notNull(),
    onboardingComplete: integer('onboarding_complete', {
      mode: 'boolean',
    }).default(false),
    termsAcceptedAt: integer('terms_accepted_at', { mode: 'timestamp_ms' }),
    bannedAt: integer('banned_at', { mode: 'timestamp_ms' }),
    banReason: text('ban_reason'),
    bannedBy: text('banned_by'),
    // Violation counters (per booking): auto-cancelled for not starting, overdue
    cancelledInStartWindowCount: integer('cancelled_in_start_window_count')
      .default(0)
      .notNull(),
    overdueCount: integer('overdue_count').default(0).notNull(),
    albumCount: integer('album_count').default(0).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('user_role_idx').on(table.role),
    index('user_status_idx').on(table.status),
    index('user_clearanceLevel_idx').on(table.clearanceLevel),
  ]
)

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)]
)

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)]
)

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
)

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))

// Telegram Link Tokens Table

export const telegramToken = sqliteTable('telegram_link_token', {
  token: text('token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
})

export const telegramLinkTokenRelations = relations(
  telegramToken,
  ({ one }) => ({
    user: one(user, {
      fields: [telegramToken.userId],
      references: [user.id],
    }),
  })
)

// Equipment Catalog Releated Tables

export const equipment = sqliteTable(
  'equipment',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    modelName: text('model_name').notNull(),
    shortName: text('short_name'),
    description: text('description'),
    categoryId: integer('category_id').references(() => category.id),
    googleCalendarId: text('gcal_id').notNull().unique(), // Dedicated Google calendar per equipment
    requiredClearanceLevel: integer('required_clearance_level').default(1),
    imagePath: text('image_path'), // R2 path: equipment-images/{id}.jpg
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('equipment_categoryId_idx').on(table.categoryId),
    index('equipment_isActive_idx').on(table.isActive),
    index('equipment_requiredClearanceLevel_idx').on(
      table.requiredClearanceLevel
    ),
  ]
)

export const category = sqliteTable('category', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
})

// Bookings Table

export const booking = sqliteTable(
  'booking',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    startTime: integer('start_time', { mode: 'timestamp_ms' }).notNull(),
    endTime: integer('end_time', { mode: 'timestamp_ms' }).notNull(),
    status: text('status', {
      enum: [
        'booked',
        'active',
        'returned',
        'cancelled',
        'overdue',
        'partially_returned',
      ],
    })
      .notNull()
      .default('booked'),
    userEventDetails: text('user_event_details'), // User-provided booking notes
    startedAt: integer('started_at', { mode: 'timestamp_ms' }), // Actual pickup time
    startReminderSentAt: integer('start_reminder_sent_at', {
      mode: 'timestamp_ms',
    }),
    startWarningSentAt: integer('start_warning_sent_at', {
      mode: 'timestamp_ms',
    }),
    returnReminderSentAt: integer('return_reminder_sent_at', {
      mode: 'timestamp_ms',
    }),
    graceWarningSentAt: integer('grace_warning_sent_at', {
      mode: 'timestamp_ms',
    }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('booking_userId_idx').on(table.userId),
    index('booking_status_idx').on(table.status),
    index('booking_startTime_idx').on(table.startTime),
    index('booking_endTime_idx').on(table.endTime),
  ]
)

export const bookingRelations = relations(booking, ({ one, many }) => ({
  user: one(user, {
    fields: [booking.userId],
    references: [user.id],
  }),
  items: many(bookingItem),
}))

// Booking Items Table
// A booking contains one or more booking items (one per piece of equipment).

export const bookingItem = sqliteTable(
  'booking_item',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    bookingId: integer('booking_id')
      .notNull()
      .references(() => booking.id, { onDelete: 'cascade' }),
    equipmentId: integer('equipment_id')
      .notNull()
      .references(() => equipment.id),
    status: text('status', {
      enum: ['booked', 'active', 'returned', 'cancelled', 'overdue'],
    })
      .notNull()
      .default('booked'),
    googleCalendarEventId: text('gcal_event_id'), // Google Calendar event ID per item
    returnedAt: integer('returned_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('booking_item_bookingId_idx').on(table.bookingId),
    index('booking_item_equipmentId_idx').on(table.equipmentId),
    index('booking_item_status_idx').on(table.status),
  ]
)

export const bookingItemRelations = relations(bookingItem, ({ one }) => ({
  booking: one(booking, {
    fields: [bookingItem.bookingId],
    references: [booking.id],
  }),
  equipment: one(equipment, {
    fields: [bookingItem.equipmentId],
    references: [equipment.id],
  }),
}))

// Photo Albums (Google Drive-backed gallery)
// Albums are stored in a shared master Google Drive account. The view link
// (`/albums/<id>`) is public and every album is listed; its Drive folder has the
// "anyone" reader permission. The edit link carries `editShareToken`; a
// logged-in user who presents it becomes an `albumMember` (co-author / editor).

export const album = sqliteTable(
  'album',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').default(''),
    driveFolderId: text('drive_folder_id').notNull().unique(),
    coverFileId: text('cover_file_id'),
    photoCount: integer('photo_count').default(0).notNull(),
    photoBytes: integer('photo_bytes').default(0).notNull(),
    favoriteCount: integer('favorite_count').default(0).notNull(),
    photosIndexedAt: integer('photos_indexed_at', { mode: 'timestamp_ms' }),
    photosIndexRequestedAt: integer('photos_index_requested_at', {
      mode: 'timestamp_ms',
    }),
    photosIndexSkipped: text('photos_index_skipped', {
      enum: ['trashed', 'missing'],
    }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    pinned: integer('pinned', { mode: 'boolean' }).default(false).notNull(),
    tombstoneReason: text('tombstone_reason', {
      enum: [
        'expired',
        'flamekeeper_left',
        'flamekeeper_lost',
        'no_space',
        'folder_deleted',
      ],
    }),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    expiryReminder30SentAt: integer('expiry_reminder_30_sent_at', {
      mode: 'timestamp_ms',
    }),
    expiryReminder7SentAt: integer('expiry_reminder_7_sent_at', {
      mode: 'timestamp_ms',
    }),
    editShareToken: text('edit_share_token').notNull().unique(),
    event: text('event').notNull().default(''),
    eventDate: integer('event_date', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('album_ownerUserId_idx').on(table.ownerUserId),
    index('album_expiresAt_idx').on(table.expiresAt),
  ]
)

export const albumMember = sqliteTable(
  'album_member',
  {
    id: text('id').primaryKey(),
    albumId: text('album_id')
      .notNull()
      .references(() => album.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex('album_member_albumId_userId_idx').on(
      table.albumId,
      table.userId
    ),
    index('album_member_userId_idx').on(table.userId),
  ]
)

export const photo = sqliteTable(
  'photo',
  {
    id: text('id').primaryKey(),
    albumId: text('album_id')
      .notNull()
      .references(() => album.id, { onDelete: 'cascade' }),
    driveFileId: text('drive_file_id').notNull(),
    name: text('name').notNull(),
    bytes: integer('bytes').default(0).notNull(),
    mimeType: text('mime_type').notNull(),
    width: integer('width'),
    height: integer('height'),
    capturedAt: integer('captured_at', { mode: 'timestamp_ms' }),
    exif: text('exif'),
    flamekeeperUserId: text('flamekeeper_user_id'),
    state: text('state', {
      enum: ['live', 'moving', 'deleted', 'dropped'],
    })
      .default('live')
      .notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index('photo_albumId_idx').on(table.albumId),
    uniqueIndex('photo_driveFileId_idx').on(table.driveFileId),
  ]
)

export const favorite = sqliteTable(
  'favorite',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    photoId: text('photo_id')
      .notNull()
      .references(() => photo.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.photoId] }),
    index('favorite_photoId_idx').on(table.photoId),
  ]
)

export const albumRelations = relations(album, ({ one, many }) => ({
  owner: one(user, {
    fields: [album.ownerUserId],
    references: [user.id],
  }),
  members: many(albumMember),
}))

export const albumMemberRelations = relations(albumMember, ({ one }) => ({
  album: one(album, {
    fields: [albumMember.albumId],
    references: [album.id],
  }),
  user: one(user, {
    fields: [albumMember.userId],
    references: [user.id],
  }),
}))

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  telegramLinkTokens: many(telegramToken),
  bookings: many(booking),
  albums: many(album),
  albumMemberships: many(albumMember),
}))

export const equipmentRelations = relations(equipment, ({ one, many }) => ({
  category: one(category, {
    fields: [equipment.categoryId],
    references: [category.id],
  }),
  bookings: many(bookingItem),
}))

export const categoryRelations = relations(category, ({ many }) => ({
  equipment: many(equipment),
}))

export const flamekeeper = sqliteTable(
  'flamekeeper',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    pledgedBytes: integer('pledged_bytes').notNull(),
    usedBytes: integer('used_bytes').default(0).notNull(),
    driveUsageBytes: integer('drive_usage_bytes').default(0).notNull(),
    driveUsageCheckedAt: integer('drive_usage_checked_at', {
      mode: 'timestamp_ms',
    }),
    state: text('state', {
      enum: ['active', 'full', 'draining', 'lost', 'drained'],
    })
      .default('active')
      .notNull(),
    graduationConfirmedAt: integer('graduation_confirmed_at', {
      mode: 'timestamp_ms',
    }),
    graduationPromptSentAt: integer('graduation_prompt_sent_at', {
      mode: 'timestamp_ms',
    }),
    drainingDeadline: integer('draining_deadline', { mode: 'timestamp_ms' }),
    drainReason: text('drain_reason', {
      enum: ['opt_out', 'pledge', 'graduation', 'domain', 'ban'],
    }),
    drainReminderSentAt: integer('drain_reminder_sent_at', {
      mode: 'timestamp_ms',
    }),
    drainAdminStartedAt: integer('drain_admin_started_at', {
      mode: 'timestamp_ms',
    }),
    drainAdminRemindedAt: integer('drain_admin_reminded_at', {
      mode: 'timestamp_ms',
    }),
    healthCursor: text('health_cursor'),
    lostSince: integer('lost_since', { mode: 'timestamp_ms' }),
    lostNotifiedAt: integer('lost_notified_at', { mode: 'timestamp_ms' }),
    lostFinalizedAt: integer('lost_finalized_at', { mode: 'timestamp_ms' }),
    healthCheckedAt: integer('health_checked_at', { mode: 'timestamp_ms' }),
    leaderboardAnonymous: integer('leaderboard_anonymous', { mode: 'boolean' })
      .default(false)
      .notNull(),
    termsAcceptedAt: integer('terms_accepted_at', {
      mode: 'timestamp_ms',
    }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('flamekeeper_state_idx').on(table.state)]
)

export const flamekeeperGrant = sqliteTable('flamekeeper_grant', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  refreshToken: text('refresh_token').notNull(),
  scopes: text('scopes').notNull(),
  lastRefreshAt: integer('last_refresh_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
})

export const volume = sqliteTable(
  'volume',
  {
    albumId: text('album_id')
      .notNull()
      .references(() => album.id, { onDelete: 'cascade' }),
    flamekeeperUserId: text('flamekeeper_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    permissionId: text('permission_id').notNull(),
    driveFolderId: text('drive_folder_id'),
    releaseLastBlockedAt: integer('release_blocked_at', {
      mode: 'timestamp_ms',
    }),
    releaseFirstBlockedAt: integer('release_blocked_since', {
      mode: 'timestamp_ms',
    }),
    releaseAlertedAt: integer('release_alerted_at', { mode: 'timestamp_ms' }),
    droppedAt: integer('dropped_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.albumId, table.flamekeeperUserId] }),
    index('volume_flamekeeperUserId_idx').on(table.flamekeeperUserId),
  ]
)

export const bufferVolume = sqliteTable('buffer_volume', {
  albumId: text('album_id')
    .primaryKey()
    .references(() => album.id, { onDelete: 'cascade' }),
  driveFolderId: text('drive_folder_id'),
  permissionId: text('permission_id').default('').notNull(),
  expectedCount: integer('expected_count').default(0).notNull(),
  expectedBytes: integer('expected_bytes').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
})

export const uploadReservation = sqliteTable(
  'upload_reservation',
  {
    id: text('id').primaryKey(),
    flamekeeperUserId: text('flamekeeper_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    albumId: text('album_id')
      .notNull()
      .references(() => album.id, { onDelete: 'cascade' }),
    bytes: integer('bytes').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index('upload_reservation_flamekeeperUserId_idx').on(
      table.flamekeeperUserId
    ),
  ]
)

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey().default('global'),

  // Notifications
  globalBookingNote: text('global_booking_note').default(''),

  clubCode: text('club_code'),

  flamekeeperCapBytes: integer('flamekeeper_cap_bytes')
    .default(21474836480)
    .notNull(),
  poolLowAlertedAt: integer('pool_low_alerted_at', { mode: 'timestamp_ms' }),

  // Dedicated Google Calendar for member birthdays (overrides the default)
  birthdaysCalendarId: text('birthdays_calendar_id'),

  // Daily operating hours (minutes since midnight: 0-1439)
  operatingHoursStart: integer('operating_hours_start').default(0),
  operatingHoursEnd: integer('operating_hours_end').default(1439),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})
