import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowUpDown, MoreHorizontal, Eye, Edit, Shield, UserX } from "lucide-react"
import { format } from "date-fns"
import { Link } from "@tanstack/react-router"

import { User } from "@/lib/user/types"

const roleConfig = {
  user: { label: "User", variant: "secondary" as const, icon: null },
  manager: { label: "Manager", variant: "default" as const, icon: Shield },
  admin: { label: "Admin", variant: "destructive" as const, icon: Shield },
}

const statusConfig = {
  Active: { label: "Active", variant: "default" as const },
  Inactive: { label: "Inactive", variant: "secondary" as const },
  "On Probation": { label: "On Probation", variant: "destructive" as const },
  Board: { label: "Board", variant: "default" as const },
  "Ex-Board": { label: "Ex-Board", variant: "secondary" as const },
  Roommate: { label: "Roommate", variant: "default" as const },
  "Ex-Roommate": { label: "Ex-Roommate", variant: "secondary" as const },
  Graduated: { label: "Graduated", variant: "secondary" as const },
}

export const createUserColumns = (
  onDeactivate?: (user: User) => void
): ColumnDef<User>[] => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "firstName", // Use id instead of accessorKey to match backend sortBy
      accessorFn: (row) => `${row.firstName || ''} ${row.lastName || ''}`.trim(),
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const user = row.original
        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No name'

        return (
          <div className="flex flex-col">
            <span className="font-medium">{displayName}</span>
            {user.email && (
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
        >
          Email
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const email = row.getValue("email") as string
        return (
          <div className="max-w-[200px] truncate font-mono text-sm">
            {email}
          </div>
        )
      },
    },
    {
      accessorKey: "role",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
        >
          Role
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const role = row.getValue("role") as keyof typeof roleConfig | null
        if (!role) {
          return <Badge variant="secondary">No Role</Badge>
        }
        const config = roleConfig[role]
        const Icon = config.icon

        return (
          <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
            {Icon && <Icon className="h-3 w-3" />}
            {config.label}
          </Badge>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: "clearanceLevel",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
        >
          Clearance
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const clearanceLevel = row.getValue("clearanceLevel") as number | null
        if (!clearanceLevel) {
          return <Badge variant="outline">No Level</Badge>
        }
        return (
          <Badge variant="outline" className="font-mono">
            Level {clearanceLevel}
          </Badge>
        )
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as keyof typeof statusConfig | null
        if (!status) {
          return <Badge variant="secondary">No Status</Badge>
        }
        const config = statusConfig[status]

        return (
          <Badge variant={config.variant}>
            {config.label}
          </Badge>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
        >
          Created
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const createdAt = row.getValue("createdAt") as Date
        if (!createdAt) return <span className="text-muted-foreground">No date</span>

        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {format(new Date(createdAt), "MMM dd, yyyy")}
            </span>
            <span className="text-sm text-muted-foreground">
              {format(new Date(createdAt), "HH:mm")}
            </span>
          </div>
        )
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const user = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(user.id)}
              >
                Copy user ID
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(user.email)}
              >
                Copy email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  to="/admin/users/$userId/edit"
                  params={{ userId: user.id }}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit user
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  to="/profile"
                  search={{ userId: user.id }}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  View profile
                </Link>
              </DropdownMenuItem>
              {onDeactivate && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDeactivate(user)}
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    Deactivate user
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

// Export a default version for backward compatibility
export const userColumns = createUserColumns()