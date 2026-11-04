import {
  MAX_PLEDGE_GB,
  MIN_PLEDGE_GB,
  formatGb,
  gbToBytes,
  isValidPledgeGb,
} from './rules'

export const PLEDGE_CHOICES = [0.5, 1, 2, 3, 4, 5].map((gb) => ({
  value: String(gb),
  label: formatGb(gbToBytes(gb)),
}))

export const DEFAULT_PLEDGE_CHOICE = '1'

export const PLEDGE_MIN_MESSAGE = `The smallest pledge is ${formatGb(gbToBytes(MIN_PLEDGE_GB))}.`

export type ResolvedPledge =
  { ok: true; gb: number; bytes: number } | { ok: false; error: string }

export function resolvePledge(choice: string, typed: string): ResolvedPledge {
  const text = typed.trim() || choice.trim()
  if (!text) return { ok: false, error: 'Choose how much you can lend.' }
  const gb = Number(text)
  if (!Number.isFinite(gb)) {
    return { ok: false, error: 'Enter the pledge as a number of GB.' }
  }
  if (gb < MIN_PLEDGE_GB) return { ok: false, error: PLEDGE_MIN_MESSAGE }
  if (!isValidPledgeGb(gb)) {
    return { ok: false, error: `The largest pledge is ${MAX_PLEDGE_GB} GB.` }
  }
  return { ok: true, gb, bytes: gbToBytes(gb) }
}
