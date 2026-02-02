import { userColumns } from "./components/user-columns"
import { UserDataTable } from "./components/user-data-table"

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
  sortBy: 'name' | 'email' | 'role' | 'status' | 'clearanceLevel' | 'createdAt'
  sortOrder: 'asc' | 'desc'
}

interface PageProps {
  users: User[]
  pagination: Pagination
  filters: Filters
}

export function Page({ users, pagination, filters }: PageProps) {
  return (
    <div className="h-full flex-1 flex-col gap-6 p-4 sm:gap-8 sm:p-8 md:flex">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">User Management</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            {pagination.totalCount > 0 
              ? `Managing ${pagination.totalCount} user${pagination.totalCount === 1 ? '' : 's'}`
              : "No users found"
            }
          </p>
        </div>
      </div>
      <UserDataTable 
        data={users} 
        columns={userColumns} 
        pagination={pagination}
        filters={filters}
      />
    </div>
  )
}