import { z } from 'zod'
import type { FlamekeeperState } from '@/lib/access/access-rules'
import { isValidPledgeGb } from './rules'

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
  role: string | null
  clearanceLevel: number | null
  status: string | null
  albumCount: number
  state: FlamekeeperState
  pledgedBytes: number
  usedBytes: number
  driveUsageBytes: number
  graduationDate: string | null
  graduationConfirmedAt: Date | null
  healthCheckedAt: Date | null
  lostSince: Date | null
  bannedAt: Date | null
  banReason: string | null
  createdAt: Date
}

export interface StopStatus {
  state: FlamekeeperState
}

const pledgeGb = z
  .number()
  .refine(isValidPledgeGb, 'Choose one of the pledge options')

const graduationDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your expected graduation date')

export const StartDriveConnectSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('signup'),
    pledgeGb,
    graduationDate,
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
