import { formatDistanceStrict } from 'date-fns'

import type { PoolOverview } from '@/lib/admin/functions/pool'
import { formatGb } from '@/lib/flamekeeper/rules'
import type { AdminFlamekeeperRow } from '@/lib/flamekeeper/types'
import { isPoolLow } from '@/lib/pool/placement'
import { HEALTH_INTERVAL_MS } from '@/lib/pool/health'

const STALE_HEALTH_MS = HEALTH_INTERVAL_MS + 60 * 60 * 1000

export function relativeTime(date: Date, now: Date): string {
  return formatDistanceStrict(date, now, { addSuffix: true })
}

export interface RowIssue {
  key: 'lost' | 'banned' | 'stale' | 'over'
  label: string
}

export function flamekeeperIssues(
  row: AdminFlamekeeperRow,
  now: Date
): RowIssue[] {
  const issues: RowIssue[] = []

  if (row.state === 'lost') {
    issues.push({
      key: 'lost',
      label: row.lostSince
        ? `lost Drive ${relativeTime(row.lostSince, now)}`
        : 'lost Drive access',
    })
  }

  if (row.bannedAt) {
    issues.push({ key: 'banned', label: 'banned' })
  }

  if (
    row.state === 'active' ||
    row.state === 'full' ||
    row.state === 'draining'
  ) {
    const checked = row.healthCheckedAt ?? row.createdAt
    if (now.getTime() - checked.getTime() > STALE_HEALTH_MS) {
      issues.push({
        key: 'stale',
        label: `not checked ${relativeTime(checked, now)}`,
      })
    }
  }

  if (row.pledgedBytes > 0 && row.usedBytes > row.pledgedBytes) {
    issues.push({
      key: 'over',
      label: `${formatGb(row.usedBytes - row.pledgedBytes)} over pledge`,
    })
  }

  return issues
}

function nameList(rows: AdminFlamekeeperRow[]): string {
  const names = rows.map((row) => row.name || row.email)
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
}

export interface AttentionItem {
  id: string
  severity: 'danger' | 'warning'
  title: string
  detail: string
}

export function attentionItems(
  rows: AdminFlamekeeperRow[],
  pool: PoolOverview | undefined,
  now: Date
): AttentionItem[] {
  const items: AttentionItem[] = []
  const withIssues = rows.map((row) => ({
    row,
    issues: flamekeeperIssues(row, now),
  }))

  const lost = withIssues.filter(({ issues }) =>
    issues.some((issue) => issue.key === 'lost')
  )
  if (lost.length > 0) {
    items.push({
      id: 'lost',
      severity: 'danger',
      title: `${lost.length} lost Drive access`,
      detail: `${nameList(lost.map(({ row }) => row))} must reconnect Google Drive.`,
    })
  }

  const banned = withIssues.filter(({ issues }) =>
    issues.some((issue) => issue.key === 'banned')
  )
  if (banned.length > 0) {
    items.push({
      id: 'banned',
      severity: 'warning',
      title: `${banned.length} banned`,
      detail: `${nameList(banned.map(({ row }) => row))} cannot reconnect Drive until unbanned.`,
    })
  }

  const stale = withIssues.filter(({ issues }) =>
    issues.some((issue) => issue.key === 'stale')
  )
  if (stale.length > 0) {
    items.push({
      id: 'stale',
      severity: 'warning',
      title: `${stale.length} not checked recently`,
      detail: `${nameList(stale.map(({ row }) => row))} — the daily check has not reached them in over a day.`,
    })
  }

  const over = withIssues.filter(({ issues }) =>
    issues.some((issue) => issue.key === 'over')
  )
  if (over.length > 0) {
    items.push({
      id: 'over',
      severity: 'warning',
      title: `${over.length} over their pledge`,
      detail: `${nameList(over.map(({ row }) => row))} — stored usage is above the pledged amount.`,
    })
  }

  if (pool && isPoolLow(pool)) {
    items.push({
      id: 'pool',
      severity: 'danger',
      title: 'Pool capacity is low',
      detail:
        pool.pledgedBytes === 0
          ? 'Nobody is lending space right now.'
          : `${formatGb(pool.freeBytes)} free of ${formatGb(pool.pledgedBytes)} pledged.`,
    })
  }

  return items
}
