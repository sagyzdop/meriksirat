import { relations, sql } from 'drizzle-orm'
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

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
  graduationYear: integer('graduation_year'),
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
  onboardingComplete: integer('onboarding_complete', {
    mode: 'boolean',
  }).default(false),
  // Violation counters (per booking): auto-cancelled for not starting, overdue
  cancelledInStartWindowCount: integer('cancelled_in_start_window_count')
    .default(0)
    .notNull(),
  overdueCount: integer('overdue_count').default(0).notNull(),
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
    index('equipment_requiredClearanceLevel_idx').on(table.requiredClearanceLevel),
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
      enum: ['booked', 'active', 'returned', 'cancelled', 'overdue', 'partially_returned'],
    })
      .notNull()
      .default('booked'),
    userEventDetails: text('user_event_details'), // User-provided booking notes
    startedAt: integer('started_at', { mode: 'timestamp_ms' }), // Actual pickup time
    startReminderSentAt: integer('start_reminder_sent_at', { mode: 'timestamp_ms' }),
    startWarningSentAt: integer('start_warning_sent_at', { mode: 'timestamp_ms' }),
    returnReminderSentAt: integer('return_reminder_sent_at', { mode: 'timestamp_ms' }),
    graceWarningSentAt: integer('grace_warning_sent_at', { mode: 'timestamp_ms' }),
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
// (`/albums/<id>`) exposes the Drive folder via the "anyone" reader permission
// when `isShared` is true. The edit link carries `editShareToken`; a logged-in
// user who presents it becomes an `albumMember` (co-author / editor).

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
    editShareToken: text('edit_share_token').notNull().unique(),
    isShared: integer('is_shared', { mode: 'boolean' }).default(false),
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
    index('album_isShared_idx').on(table.isShared),
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
    uniqueIndex('album_member_albumId_userId_idx').on(table.albumId, table.userId),
    index('album_member_userId_idx').on(table.userId),
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

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey().default('global'),

  // Notifications
  globalBookingNote: text('global_booking_note').default(''),

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
