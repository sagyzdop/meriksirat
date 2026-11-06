import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ViolationsTable } from './components/violations-table'
import type { ViolationsSearchParams } from './components/violations-table'
import type {
  ViolationRow,
  ViolationsFilters,
} from '@/lib/admin/dashboard-types'
import type { PaginationMeta } from '@/lib/pagination'

interface PageProps {
  users: ViolationRow[]
  pagination: PaginationMeta
  filters: ViolationsFilters
  search: ViolationsSearchParams
  isLoading: boolean
}

export function Page({
  users,
  pagination,
  filters,
  search,
  isLoading,
}: PageProps) {
  return (
    <PageContainer>
      <PageHeader
        title="Violations"
        description="Members with auto-cancelled or overdue bookings"
      />
      <ViolationsTable
        users={users}
        pagination={pagination}
        filters={filters}
        search={search}
        isLoading={isLoading}
      />
    </PageContainer>
  )
}
