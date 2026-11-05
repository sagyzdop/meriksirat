import {
  PLEDGE_OPTIONS_GB,
  formatGb,
  gbToBytes,
  isValidPledgeGb,
} from './rules'

export const PLEDGE_CHOICES = PLEDGE_OPTIONS_GB.map((gb) => ({
  value: String(gb),
  label: formatGb(gbToBytes(gb)),
}))

export const DEFAULT_PLEDGE_CHOICE = '1'

export type ResolvedPledge =
  { ok: true; gb: number; bytes: number } | { ok: false; error: string }

export function resolvePledge(choice: string): ResolvedPledge {
  const gb = Number(choice.trim())
  if (!choice.trim() || !isValidPledgeGb(gb)) {
    return { ok: false, error: 'Choose how much you can lend.' }
  }
  return { ok: true, gb, bytes: gbToBytes(gb) }
}
