import * as React from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DEFAULT_USER_EXPORT_KEYS,
  USER_EXPORT_FIELDS,
  usersToCsv,
  type UserExportFieldKey,
} from '@/lib/admin/csv'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import type { AdminUserExport } from '@/lib/admin/dashboard-types'
import type { ExportUsersFilters } from '@/lib/admin/dashboard-types'
import { cn } from '@/lib/utils'

interface ExportUsersDialogProps {
  filters?: ExportUsersFilters
  className?: string
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function ExportUsersDialog({
  filters = {},
  className,
}: ExportUsersDialogProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [selectedKeys, setSelectedKeys] = React.useState<UserExportFieldKey[]>([
    ...DEFAULT_USER_EXPORT_KEYS,
  ])
  const [isExporting, setIsExporting] = React.useState(false)

  const toggleKey = (key: UserExportFieldKey) => {
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key]
    )
  }

  const handleExport = async () => {
    if (selectedKeys.length === 0) {
      toast.error('Select at least one column to export')
      return
    }
    setIsExporting(true)
    try {
      const query = adminDashboardQueries.userExport(filters)
      let users = queryClient.getQueryData<AdminUserExport[]>(query.queryKey)
      if (!users) {
        users = await queryClient.fetchQuery(query)
      }
      const csv = usersToCsv(users, selectedKeys)
      downloadCsv(csv, 'users-export.csv')
      toast.success(
        `Exported ${users.length} user${users.length === 1 ? '' : 's'}`
      )
      setOpen(false)
    } catch (error) {
      toast.error('Failed to export users', {
        description:
          error instanceof Error ? error.message : 'An error occurred',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn('h-8', className)}>
          <Download className="mr-2 h-4 w-4" />
          Export Users
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Users</DialogTitle>
          <DialogDescription>
            Download a CSV of all users matching the current filters. The export
            includes every matching user, not just the current page.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-md border p-3">
          {USER_EXPORT_FIELDS.map((field) => {
            const isSelected = selectedKeys.includes(field.key)
            return (
              <div key={field.key} className="flex items-center gap-2.5">
                <Checkbox
                  id={`export-field-${field.key}`}
                  checked={isSelected}
                  onCheckedChange={() => toggleKey(field.key)}
                />
                <Label
                  htmlFor={`export-field-${field.key}`}
                  className="cursor-pointer font-normal"
                >
                  {field.label}
                </Label>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={isExporting || selectedKeys.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Download CSV'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
