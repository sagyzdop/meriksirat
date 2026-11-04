import { z } from 'zod'
import type { FlamekeeperState } from '@/lib/access/access-rules'
import { MAX_PLEDGE_GB, MIN_PLEDGE_GB } from './rules'

export interface MyFlamekeeper {
  state: FlamekeeperState
  pledgedBytes: number
  usedBytes: number
  graduationDate: string | null
  graduationConfirmDue: boolean
  lostSince: Date | null
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
  graduationDate: string | null
  bannedAt: Date | null
  banReason: string | null
  createdAt: Date
}

export interface StopStatus {
  state: FlamekeeperState
}

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
