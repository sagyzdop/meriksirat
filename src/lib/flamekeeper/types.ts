import { z } from 'zod'
import type { FlamekeeperState } from '@/lib/access/access-rules'
import type { DrainReason } from '@/lib/pool/drain'
import { MAX_PLEDGE_GB, MIN_PLEDGE_GB } from './rules'

export interface MyFlamekeeper {
  state: FlamekeeperState
  pledgedBytes: number
  usedBytes: number
  graduationDate: string
  graduationConfirmDue: boolean
  drainingDeadline: Date | null
  drainReason: DrainReason | null
  drainBytesLeft: number
  lostSince: Date | null
  albumsHosted: number
}

export interface AdminFlamekeeperRow {
  userId: string
  name: string
  email: string
  image: string | null
  isMember: boolean
  state: FlamekeeperState
  pledgedBytes: number
  usedBytes: number
  graduationDate: string
  drainingDeadline: Date | null
  drainBytesLeft: number
  bannedAt: Date | null
  banReason: string | null
  createdAt: Date
}

export interface DrainStatus {
  state: FlamekeeperState
  drainReason: DrainReason | null
  drainingDeadline: Date | null
  bytesLeft: number
}

export type RelayHandout =
  | {
      kind: 'photo'
      photoId: string
      albumId: string
      sourceFileId: string
      name: string
      mimeType: string
      bytes: number
      sourceToken: string
      uploadUrl: string
      reservationId: string
    }
  | { kind: 'done'; status: DrainStatus }
  | { kind: 'no_space'; message: string }

const pledgeGb = z
  .number()
  .min(MIN_PLEDGE_GB, `Pledge at least ${MIN_PLEDGE_GB} GB`)
  .max(MAX_PLEDGE_GB, `Pledge at most ${MAX_PLEDGE_GB} GB`)

const graduationDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your expected graduation date')

export const StartDriveConnectSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('signup'),
    pledgeGb,
    graduationDate,
    termsAccepted: z.literal(true, {
      message: 'You must accept the flamekeeper terms',
    }),
  }),
  z.object({ mode: z.literal('reconnect') }),
])

export const UpdateFlamekeeperSchema = z.object({
  pledgeGb,
  graduationDate,
})

export const ConfirmGraduationSchema = z.object({
  graduationDate: graduationDate.optional(),
})

export const AdminFlamekeepersSchema = z.object({
  search: z.string().optional(),
})

export const relaySource = z.object({ userId: z.string().optional() })

export const ConfirmRelaySchema = relaySource.extend({
  photoId: z.string(),
  reservationId: z.string(),
  fileId: z.string(),
})

export const ReleaseRelaySchema = relaySource.extend({
  albumId: z.string(),
  reservationId: z.string(),
  quotaExceeded: z.boolean().default(false),
})
