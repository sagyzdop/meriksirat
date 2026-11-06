import { useQueryClient } from '@tanstack/react-query'

import { ExportCsvDialog } from '@/components/shared/export-csv-dialog'
import {
  DEFAULT_USER_EXPORT_KEYS,
  USER_EXPORT_FIELDS,
  usersToCsv,
} from '@/lib/admin/csv'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import type {
  AdminUserExport,
  ExportUsersFilters,
} from '@/lib/admin/dashboard-types'

interface ExportUsersDialogProps {
  filters?: ExportUsersFilters
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ExportUsersDialog({
  filters = {},
  ...props
}: ExportUsersDialogProps) {
  const queryClient = useQueryClient()
  return (
    <ExportCsvDialog
      {...props}
      noun="member"
      description="Download a CSV of all members matching the current filters. The export includes every matching member, not just the current page."
      fields={USER_EXPORT_FIELDS}
      defaultKeys={DEFAULT_USER_EXPORT_KEYS}
      fileName="members-export.csv"
      load={async () => {
        const query = adminDashboardQueries.userExport(filters)
        return (
          queryClient.getQueryData<AdminUserExport[]>(query.queryKey) ??
          queryClient.fetchQuery(query)
        )
      }}
      toCsv={usersToCsv}
    />
  )
}
