import { relations, sql } from 'drizzle-orm'
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

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

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  telegramLinkTokens: many(telegramToken),
  bookings: many(booking),
}))

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

export const equipmentRelations = relations(equipment, ({ one, many }) => ({
  category: one(category, {
    fields: [equipment.categoryId],
    references: [category.id],
  }),
  bookings: many(booking),
}))

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

export const categoryRelations = relations(category, ({ many }) => ({
  equipment: many(equipment),
}))

// Bookings Table

export const booking = sqliteTable(
  'booking',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    equipmentId: integer('equipment_id')
      .notNull()
      .references(() => equipment.id),
    startTime: integer('start_time', { mode: 'timestamp_ms' }).notNull(),
    endTime: integer('end_time', { mode: 'timestamp_ms' }).notNull(),
    status: text('status', {
      enum: ['booked', 'active', 'returned', 'cancelled', 'overdue'],
    })
      .notNull()
      .default('booked'),
    googleCalendarEventId: text('gcal_event_id'), // Google Calendar event ID
    userEventDetails: text('user_event_details'), // User-provided booking notes
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
    index('booking_equipmentId_idx').on(table.equipmentId),
    index('booking_status_idx').on(table.status),
    index('booking_startTime_idx').on(table.startTime),
    index('booking_endTime_idx').on(table.endTime),
  ]
)

export const bookingRelations = relations(booking, ({ one }) => ({
  user: one(user, {
    fields: [booking.userId],
    references: [user.id],
  }),
  equipment: one(equipment, {
    fields: [booking.equipmentId],
    references: [equipment.id],
  }),
}))

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey().default('global'),

  // Notifications
  globalBookingNote: text('global_booking_note').default(''),

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
