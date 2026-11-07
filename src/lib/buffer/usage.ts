import { BUFFER_FULL_MESSAGE } from './messages'

export type BufferLevel = 'ok' | 'warn' | 'full'
export type BufferMarker = 'warn' | 'full'

export interface BufferUsage {
  usedBytes: number
  limitBytes: number | null
}

export interface BufferOverview {
  usedBytes: number
  availableLimitBytes: number | null
  configuredLimitBytes: number
  limitBytes: number | null
  percent: number | null
  level: BufferLevel
}

export function effectiveLimitBytes(
  configuredLimitBytes: number,
  availableLimitBytes: number | null
): number | null {
  const limits = [configuredLimitBytes, availableLimitBytes].filter(
    (n): n is number => typeof n === 'number' && n > 0
  )
  return limits.length > 0 ? Math.min(...limits) : null
}

export function bufferUsageLevel(
  usage: BufferUsage,
  alertPercent: number
): BufferLevel {
  const { usedBytes, limitBytes } = usage
  if (!limitBytes || limitBytes <= 0) return 'ok'
  if (usedBytes >= limitBytes) return 'full'
  if (usedBytes >= (limitBytes * alertPercent) / 100) return 'warn'
  return 'ok'
}

export function usagePercent(
  usedBytes: number,
  configuredLimitBytes: number
): number | null {
  if (configuredLimitBytes <= 0) return null
  return Math.min(100, Math.round((100 * usedBytes) / configuredLimitBytes))
}

export function buildBufferOverview(
  usage: BufferUsage,
  settings: { bufferLimitBytes: number; bufferAlertPercent: number }
): BufferOverview {
  const limitBytes = effectiveLimitBytes(
    settings.bufferLimitBytes,
    usage.limitBytes
  )
  return {
    usedBytes: usage.usedBytes,
    availableLimitBytes: usage.limitBytes,
    configuredLimitBytes: settings.bufferLimitBytes,
    limitBytes,
    percent: usagePercent(usage.usedBytes, settings.bufferLimitBytes),
    level: bufferUsageLevel(
      { usedBytes: usage.usedBytes, limitBytes },
      settings.bufferAlertPercent
    ),
  }
}

export function planBufferAlert(
  level: BufferLevel,
  marker: BufferMarker | null
): { notify: boolean; marker: BufferMarker | null } {
  if (level === 'ok') return { notify: false, marker: null }
  if (level === 'full') return { notify: marker !== 'full', marker: 'full' }
  return { notify: marker === null, marker: 'warn' }
}

export function bufferBannerVisible(
  email: string,
  level: BufferLevel
): boolean {
  return level !== 'ok' && email.trim().toLowerCase().endsWith('@nu.edu.kz')
}

export function bufferUploadBlock(
  overview: Pick<BufferOverview, 'level'> | null
): string | null {
  if (!overview) return null
  return overview.level === 'full' ? BUFFER_FULL_MESSAGE : null
}

export const USAGE_REWRITE_MS = 6 * 60 * 60 * 1000

export function planUsageWrite(
  stored: (BufferUsage & { checkedAt: number }) | null,
  next: BufferUsage & { checkedAt: number }
): boolean {
  if (!stored) return true
  if (
    stored.usedBytes !== next.usedBytes ||
    stored.limitBytes !== next.limitBytes
  ) {
    return true
  }
  return next.checkedAt - stored.checkedAt >= USAGE_REWRITE_MS
}
