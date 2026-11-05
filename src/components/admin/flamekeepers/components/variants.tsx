// PROTOTYPE: three tweaks of the original stacked layout. All three keep the
// capacity summary above a plain roster table; they differ in how much chrome
// the summary gets and whether the offload table is collapsed.
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import type { PoolOverview } from '@/lib/admin/functions/pool'
import type { FreeSpaceSuggestion } from '@/lib/admin/functions/free-space'
import type { AdminFlamekeeperRow } from '@/lib/flamekeeper/types'
import { AttentionList } from './attention'
import { PoolLine, PoolMeter, PoolStats, PoolSummary } from './capacity'
import { FlamekeeperTable } from './flamekeeper-table'
import { OffloadSection } from './offload'
import type { FlamekeeperTableFilters } from '../types'

interface VariantProps {
  rows: AdminFlamekeeperRow[]
  filters: FlamekeeperTableFilters
  pool?: PoolOverview
  poolLoading: boolean
  suggestions?: FreeSpaceSuggestion[]
  offloadLoading: boolean
  canEditCap: boolean
  canManageOffload: boolean
  canBan: boolean
  viewerId?: string
  isLoading: boolean
}

function Roster(props: VariantProps) {
  return (
    <FlamekeeperTable
      rows={props.rows}
      filters={props.filters}
      isLoading={props.isLoading}
      canBan={props.canBan}
      viewerId={props.viewerId}
    />
  )
}

export function VariantA(props: VariantProps) {
  return (
    <PageContainer>
      <PageHeader title="Flamekeepers" />
      <div className="space-y-6">
        <PoolSummary
          pool={props.pool}
          isLoading={props.poolLoading}
          canEditCap={props.canEditCap}
        />
        <AttentionList rows={props.rows} pool={props.pool} />
        <Roster {...props} />
        {props.canManageOffload && (
          <OffloadSection
            suggestions={props.suggestions ?? []}
            isLoading={props.offloadLoading}
          />
        )}
      </div>
    </PageContainer>
  )
}

export function VariantB(props: VariantProps) {
  return (
    <PageContainer>
      <PageHeader title="Flamekeepers" />
      {props.pool ? (
        <div className="space-y-3">
          <PoolStats pool={props.pool} size="small" />
          <PoolMeter pool={props.pool} />
        </div>
      ) : (
        <PoolSummary isLoading={props.poolLoading} />
      )}
      <div className="mt-6 space-y-6">
        <AttentionList rows={props.rows} pool={props.pool} bare />
        <Roster {...props} />
        {props.canManageOffload && (
          <OffloadSection
            suggestions={props.suggestions ?? []}
            isLoading={props.offloadLoading}
            collapsible
          />
        )}
      </div>
    </PageContainer>
  )
}

export function VariantC(props: VariantProps) {
  return (
    <PageContainer>
      <PageHeader title="Flamekeepers" />
      <div className="space-y-6">
        {props.pool ? (
          <PoolLine pool={props.pool} canEditCap={props.canEditCap} />
        ) : (
          <PoolSummary isLoading={props.poolLoading} />
        )}
        <AttentionList rows={props.rows} pool={props.pool} bare />
        <Roster {...props} />
        {props.canManageOffload && (
          <OffloadSection
            suggestions={props.suggestions ?? []}
            isLoading={props.offloadLoading}
          />
        )}
      </div>
    </PageContainer>
  )
}
