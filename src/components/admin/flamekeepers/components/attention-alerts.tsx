// PROTOTYPE: flamekeeper-specific alerts, built on the dashboard alert
// patterns. The dashboard alert list stays where it is; this is the copied,
// flamekeeper-focused version requested for the new screen.
import { DashboardAlerts } from '@/components/admin/dashboard/components/dashboard-alerts'
import { Section } from '@/components/layout/section'
import type { PoolOverview } from '@/lib/admin/functions/pool'
import type { DashboardAlert } from '@/lib/admin/dashboard-types'
import type { AdminFlamekeeperRow } from '@/lib/flamekeeper/types'
import { formatGb } from '@/lib/flamekeeper/rules'
import { HEALTH_INTERVAL_MS } from '@/lib/pool/health'
import { isPoolLow } from '@/lib/pool/placement'

const STALE_HEALTH_MS = HEALTH_INTERVAL_MS + 60 * 60 * 1000

export function buildFlamekeeperAlerts(
  rows: AdminFlamekeeperRow[],
  pool?: PoolOverview,
  now: Date = new Date()
): DashboardAlert[] {
  const alerts: DashboardAlert[] = []

  const lost = rows.filter((row) => row.state === 'lost')
  if (lost.length > 0) {
    alerts.push({
      id: 'lost-flamekeepers',
      severity: 'danger',
      title: `${lost.length} flamekeeper${lost.length === 1 ? '' : 's'} lost Drive access`,
      message:
        'They need to reconnect Google Drive from their profile. The reconnect reminder is sent by email.',
    })
  }

  const banned = rows.filter((row) => row.bannedAt)
  if (banned.length > 0) {
    alerts.push({
      id: 'banned-flamekeepers',
      severity: 'danger',
      title: `${banned.length} banned flamekeeper${banned.length === 1 ? '' : 's'}`,
      message:
        'Banned accounts cannot reconnect Drive. Review whether their flamekeeping should stay stopped.',
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
    alerts.push({
      id: 'stale-health',
      severity: 'warning',
      title: `${stale.length} flamekeeper${stale.length === 1 ? '' : 's'} not checked recently`,
      message:
        'The daily health check has not reached them in over 25 hours. Their Drive connection may need attention.',
    })
  }

  const overPledge = rows.filter(
    (row) => row.pledgedBytes > 0 && row.usedBytes > row.pledgedBytes
  )
  if (overPledge.length > 0) {
    alerts.push({
      id: 'over-pledge',
      severity: 'warning',
      title: `${overPledge.length} flamekeeper${overPledge.length === 1 ? '' : 's'} over their pledge`,
      message:
        'Stored usage is above the pledged amount. Check whether their pledge needs raising or albums need moving.',
    })
  }

  if (pool && isPoolLow(pool)) {
    alerts.push({
      id: 'pool-low',
      severity: 'danger',
      title: 'Pool capacity is low',
      message: `${formatGb(pool.freeBytes)} free of ${formatGb(pool.pledgedBytes)} pledged across ${pool.flamekeepers} flamekeeper${pool.flamekeepers === 1 ? '' : 's'}.`,
    })
  }

  return alerts
}

interface AttentionAlertsProps {
  rows: AdminFlamekeeperRow[]
  pool?: PoolOverview
  isLoading?: boolean
}

export function AttentionAlerts({
  rows,
  pool,
  isLoading = false,
}: AttentionAlertsProps) {
  const alerts = buildFlamekeeperAlerts(rows, pool)

  return (
    <Section
      title="Needs attention"
      description="Flamekeepers whose connection or capacity needs a human look."
      spacing="compact"
    >
      <DashboardAlerts alerts={alerts} isLoading={isLoading} />
    </Section>
  )
}
