import { BUFFER_FULL_MESSAGE } from './messages'

export const BUFFER_WARN_FRACTION = 0.9

export type BufferLevel = 'ok' | 'warn' | 'full'
export type BufferMarker = 'warn' | 'full'

export interface BufferUsage {
  usedBytes: number
  limitBytes: number | null
}

export function bufferUsageLevel(usage: BufferUsage): BufferLevel {
  const { usedBytes, limitBytes } = usage
  if (!limitBytes || limitBytes <= 0) return 'ok'
  if (usedBytes >= limitBytes) return 'full'
  if (usedBytes >= limitBytes * BUFFER_WARN_FRACTION) return 'warn'
  return 'ok'
}

export function usagePercent(usage: BufferUsage): number | null {
  if (!usage.limitBytes || usage.limitBytes <= 0) return null
  return Math.min(100, Math.round((100 * usage.usedBytes) / usage.limitBytes))
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

export function bufferUploadBlock(usage: BufferUsage | null): string | null {
  if (!usage) return null
  return bufferUsageLevel(usage) === 'full' ? BUFFER_FULL_MESSAGE : null
}
