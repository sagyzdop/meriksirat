import { createUserColumns } from "./components/user-columns"
import { UserDataTable } from "./components/user-data-table"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { useState } from "react"
import { DeactivateUserDialog } from "./components/deactivate-user-dialog"

interface User {
  id: string
  name: string
  email: string
  role: 'user' | 'manager' | 'admin' | null
  clearanceLevel: number | null
  status: 'Active' | 'Inactive' | 'On Probation' | 'Board' | 'Ex-Board' | 'Roommate' | 'Ex-Roommate' | 'Graduated' | null
  firstName: string | null
  lastName: string | null
  createdAt: Date
  updatedAt: Date
}

interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

interface Filters {
  role?: 'user' | 'manager' | 'admin'
  status?: 'Active' | 'Inactive' | 'On Probation' | 'Board' | 'Ex-Board' | 'Roommate' | 'Ex-Roommate' | 'Graduated'
  clearanceLevel?: number
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
}

export function Page({ users, pagination, filters }: PageProps) {
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const description = pagination.totalCount > 0 
    ? `Managing ${pagination.totalCount} user${pagination.totalCount === 1 ? '' : 's'}`
    : "No users found"

  const handleDeactivateUser = (user: User) => {
    setSelectedUser(user)
    setDeactivateDialogOpen(true)
  }

  const columns = createUserColumns(undefined, handleDeactivateUser)

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
      />

      <DeactivateUserDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
        user={selectedUser}
      />
    </PageContainer>
  )
}