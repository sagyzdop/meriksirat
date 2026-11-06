import { createUserColumns, UserField } from './components/user-columns'
import { UserDataTable } from './components/user-data-table'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ExportUsersDialog } from '@/components/shared/export-users-dialog'
import { updateUserAdminFn } from '@/lib/user'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { User } from '@/lib/user/types'
import type { ExportUsersFilters } from '@/lib/admin/dashboard-types'
import type { PaginationMeta } from '@/lib/pagination'
import { errorMessage } from '@/lib/utils'

interface Filters {
  role?: string[]
  status?: string[]
  clearanceLevel?: number[]
  search?: string
  page: number
  limit: number
  sortBy:
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'role'
    | 'status'
    | 'clearanceLevel'
    | 'albumCount'
    | 'createdAt'
  sortOrder: 'asc' | 'desc'
}

interface PageProps {
  users: User[]
  pagination: PaginationMeta
  filters: Filters
  isLoading?: boolean
  canAssignElevatedRoles?: boolean
}

export function Page({
  users,
  pagination,
  filters,
  isLoading = false,
  canAssignElevatedRoles = true,
}: PageProps) {
  const queryClient = useQueryClient()

  const description =
    pagination.totalCount > 0
      ? `Managing ${pagination.totalCount} member${pagination.totalCount === 1 ? '' : 's'}`
      : 'No members found'

  const handleUpdateField = async (
    userId: string,
    field: UserField,
    value: string
  ) => {
    try {
      const data =
        field === 'clearanceLevel'
          ? { clearanceLevel: parseInt(value) }
          : { [field]: value }

      await updateUserAdminFn({
        data: { userId, ...data },
      })
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Member updated')
    } catch (error) {
      toast.error('Failed to update member', {
        description: errorMessage(error, 'An error occurred'),
      })
    }
  }

  const columns = createUserColumns({
    onUpdateField: handleUpdateField,
    canAssignElevatedRoles,
  })

  return (
    <PageContainer>
      <PageHeader
        title="Member Management"
        description={description}
        actions={<ExportUsersDialog filters={filters as ExportUsersFilters} />}
      />
      <UserDataTable
        data={users}
        columns={columns}
        pagination={pagination}
        filters={filters}
        isLoading={isLoading}
      />
    </PageContainer>
  )
}
