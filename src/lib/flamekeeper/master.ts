export function isMasterEmail(
  email: string | null | undefined,
  masterEmail: string | null | undefined
): boolean {
  const master = (masterEmail ?? '').trim().toLowerCase()
  if (!master || !email) return false
  return email.trim().toLowerCase() === master
}

export const MASTER_FLAMEKEEPER_MESSAGE =
  'The club account owns the album folders and cannot be a flamekeeper.'
