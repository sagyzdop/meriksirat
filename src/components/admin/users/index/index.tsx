import { createUserColumns } from "./components/user-columns"
import { UserDataTable } from "./components/user-data-table"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { useState } from "react"
import { DeactivateUserDialog } from "./components/deactivate-user-dialog"
import { updateUserAdminFn } from "@/lib/user"
import { useQueryClient } from "@tanstack/react-query"

import { User } from "@/lib/user/types"

interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

interface Filters {
  role?: string[]
  status?: string[]
  clearanceLevel?: number[]
  search?: string
  page: number
  limit: number
  sortBy: 'firstName' | 'lastName' | 'email' | 'role' | 'status' | 'clearanceLevel' | 'createdAt'
  sortOrder: 'asc' | 'desc'
}

interface PageProps {
  users: User[]
  pagination: Pagination
  filters: Filters
  isLoading?: boolean
}

export function Page({ users, pagination, filters, isLoading = false }: PageProps) {
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const queryClient = useQueryClient()

  const description = pagination.totalCount > 0
    ? `Managing ${pagination.totalCount} user${pagination.totalCount === 1 ? '' : 's'}`
    : "No users found"

  const handleDeactivateUser = (user: User) => {
    setSelectedUser(user)
    setDeactivateDialogOpen(true)
  }

  const handleConfirmDeactivation = async (userId: string) => {
    await updateUserAdminFn({
      data: {
        userId,
        status: 'Inactive'
      }
    })
    await queryClient.invalidateQueries({ queryKey: ['users'] })
  }

  const columns = createUserColumns(handleDeactivateUser)

  return (
    <PageContainer>
      <PageHeader
        title="Manage Users"
        description={description}
      />
      <UserDataTable
        data={users}
        columns={columns}
        pagination={pagination}
        filters={filters}
        isLoading={isLoading}
      />

      <DeactivateUserDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
        user={selectedUser}
        onConfirm={handleConfirmDeactivation}
      />
    </PageContainer>
  )
}