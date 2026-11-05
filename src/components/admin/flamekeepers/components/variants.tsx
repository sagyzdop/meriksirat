// PROTOTYPE: three layouts of the same flamekeepers screen, switchable with
// ?variant=. Only one should survive into the real page.
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import type { PoolOverview } from '@/lib/admin/functions/pool'
import type { FreeSpaceSuggestion } from '@/lib/admin/functions/free-space'
import type { AdminFlamekeeperRow } from '@/lib/flamekeeper/types'
import { CapacityPanel } from './capacity-panel'
import { AttentionAlerts } from './attention-alerts'
import { FlamekeeperDataTable } from './flamekeeper-data-table'
import { OffloadPanel } from './offload-panel'
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

function description(rows: AdminFlamekeeperRow[]) {
  return rows.length === 1
    ? '1 flamekeeper, with pledge, usage and graduation.'
    : `${rows.length} flamekeepers, with pledge, usage and graduation.`
}

export function VariantA(props: VariantProps) {
  return (
    <PageContainer>
      <PageHeader title="Flamekeepers" description={description(props.rows)} />
      <div className="space-y-8">
        <CapacityPanel
          pool={props.pool}
          isLoading={props.poolLoading}
          canEditCap={props.canEditCap}
        />
        <AttentionAlerts
          rows={props.rows}
          pool={props.pool}
          isLoading={props.isLoading}
        />
        <FlamekeeperDataTable
          rows={props.rows}
          filters={props.filters}
          isLoading={props.isLoading}
          canBan={props.canBan}
          viewerId={props.viewerId}
        />
        {props.canManageOffload && (
          <OffloadPanel
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
      <PageHeader title="Flamekeepers" description={description(props.rows)} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          <AttentionAlerts
            rows={props.rows}
            pool={props.pool}
            isLoading={props.isLoading}
          />
          <FlamekeeperDataTable
            rows={props.rows}
            filters={props.filters}
            isLoading={props.isLoading}
            canBan={props.canBan}
            viewerId={props.viewerId}
          />
        </div>
        <aside className="min-w-0 space-y-8">
          <CapacityPanel
            pool={props.pool}
            isLoading={props.poolLoading}
            canEditCap={props.canEditCap}
            layout="column"
          />
          {props.canManageOffload && (
            <OffloadPanel
              suggestions={props.suggestions ?? []}
              isLoading={props.offloadLoading}
              compact
            />
          )}
        </aside>
      </div>
    </PageContainer>
  )
}

export function VariantC(props: VariantProps) {
  return (
    <PageContainer>
      <PageHeader title="Flamekeepers" description={description(props.rows)} />
      <div className="space-y-8">
        <FlamekeeperDataTable
          rows={props.rows}
          filters={props.filters}
          isLoading={props.isLoading}
          canBan={props.canBan}
          viewerId={props.viewerId}
        />
        <div className="grid gap-8 lg:grid-cols-2">
          <CapacityPanel
            pool={props.pool}
            isLoading={props.poolLoading}
            canEditCap={props.canEditCap}
          />
          <AttentionAlerts
            rows={props.rows}
            pool={props.pool}
            isLoading={props.isLoading}
          />
        </div>
        {props.canManageOffload && (
          <OffloadPanel
            suggestions={props.suggestions ?? []}
            isLoading={props.offloadLoading}
          />
        )}
      </div>
    </PageContainer>
  )
}
