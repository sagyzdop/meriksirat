// PROTOTYPE: compact attention list. One line per problem, names inside the
// line. Renders nothing when there is nothing to say.
import type { PoolOverview } from '@/lib/admin/functions/pool'
import { formatGb } from '@/lib/flamekeeper/rules'
import type { AdminFlamekeeperRow } from '@/lib/flamekeeper/types'
import { isPoolLow } from '@/lib/pool/placement'
import { HEALTH_INTERVAL_MS } from '@/lib/pool/health'
import { cn } from '@/lib/utils'

const STALE_HEALTH_MS = HEALTH_INTERVAL_MS + 60 * 60 * 1000

interface AttentionItem {
  id: string
  severity: 'danger' | 'warning'
  title: string
  detail?: string
}

function names(rows: AdminFlamekeeperRow[]): string {
  const list = rows.map((row) => row.name || row.email)
  if (list.length <= 2) return list.join(' and ')
  return `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`
}

export function buildAttentionItems(
  rows: AdminFlamekeeperRow[],
  pool: PoolOverview | undefined,
  now: Date
): AttentionItem[] {
  const items: AttentionItem[] = []

  const lost = rows.filter((row) => row.state === 'lost')
  if (lost.length > 0) {
    items.push({
      id: 'lost',
      severity: 'danger',
      title: `${lost.length} lost Drive access`,
      detail: names(lost),
    })
  }

  const banned = rows.filter((row) => row.bannedAt)
  if (banned.length > 0) {
    items.push({
      id: 'banned',
      severity: 'danger',
      title: `${banned.length} banned`,
      detail: names(banned),
    })
  }

  const stale = rows.filter((row) => {
    if (
      row.state !== 'active' &&
      row.state !== 'full' &&
      row.state !== 'draining'
    ) {
      return false
    }
    const checked = row.healthCheckedAt ?? row.createdAt
    return now.getTime() - checked.getTime() > STALE_HEALTH_MS
  })
  if (stale.length > 0) {
    items.push({
      id: 'stale',
      severity: 'warning',
      title: `${stale.length} not checked in 24h`,
      detail: names(stale),
    })
  }

  const over = rows.filter(
    (row) => row.pledgedBytes > 0 && row.usedBytes > row.pledgedBytes
  )
  if (over.length > 0) {
    items.push({
      id: 'over',
      severity: 'warning',
      title: `${over.length} over pledge`,
      detail: names(over),
    })
  }

  if (pool && isPoolLow(pool)) {
    items.push({
      id: 'pool',
      severity: 'danger',
      title: 'Pool capacity is low',
      detail: `${formatGb(pool.freeBytes)} free of ${formatGb(pool.pledgedBytes)}`,
    })
  }

  return items
}

interface AttentionListProps {
  rows: AdminFlamekeeperRow[]
  pool?: PoolOverview
  className?: string
  bare?: boolean
}

export function AttentionList({
  rows,
  pool,
  className,
  bare = false,
}: AttentionListProps) {
  const items = buildAttentionItems(rows, pool, new Date())
  if (items.length === 0) return null

  return (
    <section
      aria-label="Needs attention"
      className={cn('divide-y', !bare && 'rounded-lg border', className)}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2 text-sm',
            bare ? 'px-0' : 'px-4'
          )}
        >
          <span
            className={cn(
              'mr-1 inline-block size-1.5 shrink-0 translate-y-[-1px] rounded-full',
              item.severity === 'danger' ? 'bg-red-500' : 'bg-amber-500'
            )}
            aria-hidden="true"
          />
          <span className="font-medium">{item.title}</span>
          {item.detail && (
            <>
              <span className="text-muted-foreground" aria-hidden="true">
                ·
              </span>
              <span className="text-muted-foreground">{item.detail}</span>
            </>
          )}
        </div>
      ))}
    </section>
  )
}
