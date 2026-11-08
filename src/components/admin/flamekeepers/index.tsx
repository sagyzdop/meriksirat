import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ExportFlamekeepersDialog } from '@/components/shared/export-flamekeepers-dialog'
import type { AdminFlamekeeperRow } from '@/lib/flamekeeper/types'
import { FlamekeeperTable } from './components/flamekeeper-table'
import type { FlamekeeperTableFilters } from './types'

interface PageProps {
  rows: AdminFlamekeeperRow[]
  filters: FlamekeeperTableFilters
  isLoading?: boolean
  canBan?: boolean
  viewerId?: string
}

export function Page({
  rows,
  filters,
  isLoading = false,
  canBan = false,
  viewerId,
}: PageProps) {
  const description =
    rows.length > 0
      ? `Managing ${rows.length} flamekeeper${rows.length === 1 ? '' : 's'}`
      : 'No flamekeepers found'

  return (
    <PageContainer>
      <PageHeader
        title="Flamekeeper Management"
        description={description}
        actions={
          <ExportFlamekeepersDialog
            search={filters.search}
            status={filters.status}
          />
        }
      />
      <FlamekeeperTable
        rows={rows}
        filters={filters}
        isLoading={isLoading}
        canBan={canBan}
        viewerId={viewerId}
      />
    </PageContainer>
  )
}
