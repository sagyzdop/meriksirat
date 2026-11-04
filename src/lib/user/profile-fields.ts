import { z } from 'zod'
import { UpdateUserProfileSchema } from './types'

export type ProfileFieldKey =
  | 'firstName'
  | 'lastName'
  | 'birthday'
  | 'major'
  | 'graduationDate'
  | 'nuId'
  | 'instagramUsername'

export type ProfileFieldResult =
  | { ok: true; data: z.infer<typeof UpdateUserProfileSchema> }
  | { ok: false; error: string }

const REQUIRED_MESSAGE: Partial<Record<ProfileFieldKey, string>> = {
  firstName: 'First name is required',
  lastName: 'Last name is required',
  birthday: 'Enter your birthday',
  graduationDate: 'Enter your graduation month',
  nuId: 'Enter your NU ID as digits',
}

function fail(key: ProfileFieldKey, fallback: string): ProfileFieldResult {
  return { ok: false, error: REQUIRED_MESSAGE[key] ?? fallback }
}

export function profileFieldPayload(
  key: ProfileFieldKey,
  draft: string
): ProfileFieldResult {
  const text = draft.trim()
  let value: string | number
  switch (key) {
    case 'firstName':
    case 'lastName':
    case 'birthday':
      if (!text) return fail(key, 'Required')
      value = text
      break
    case 'major':
      value = text
      break
    case 'instagramUsername':
      value = text.replace(/^@/, '')
      break
    case 'nuId':
      if (!/^\d+$/.test(text)) return fail(key, 'Enter digits only')
      value = Number(text)
      break
    case 'graduationDate':
      if (!text) return fail(key, 'Enter your graduation month')
      value = text
      break
  }
  const parsed = UpdateUserProfileSchema.pick({
    [key]: true,
  } as never).safeParse({ [key]: value })
  if (!parsed.success) return fail(key, parsed.error.issues[0].message)
  return { ok: true, data: { [key]: value } }
}
