export const BAN_REASON_MAX = 500

export type BanCheck =
  { ok: true; reason: string } | { ok: false; message: string }

export function checkBan(input: {
  actorId: string
  targetId: string
  reason: string
}): BanCheck {
  if (input.actorId === input.targetId) {
    return { ok: false, message: 'You cannot ban yourself' }
  }
  const reason = input.reason.trim()
  if (!reason) return { ok: false, message: 'Give a reason for the ban' }
  if (reason.length > BAN_REASON_MAX) {
    return {
      ok: false,
      message: `Keep the reason under ${BAN_REASON_MAX} characters`,
    }
  }
  return { ok: true, reason }
}
