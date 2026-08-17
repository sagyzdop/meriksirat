import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTelegramUsername(
  username?: string | null
): string | null {
  const cleaned = username?.replace(/^@/, '').trim()
  return cleaned ? `@${cleaned}` : null
}

type UserIdentity = {
  firstName?: string | null
  lastName?: string | null
  name?: string | null
  telegramUsername?: string | null
  email?: string | null
}

export function formatUserDisplayName(user: UserIdentity): string {
  const fullName = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()
  const baseName = fullName || user.name || 'Unknown user'
  const telegramHandle = formatTelegramUsername(user.telegramUsername)

  return telegramHandle ? `${baseName} (${telegramHandle})` : baseName
}
