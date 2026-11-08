import { useQueryClient } from '@tanstack/react-query'

import { ExportCsvDialog } from '@/components/shared/export-csv-dialog'
import {
  DEFAULT_FLAMEKEEPER_EXPORT_KEYS,
  FLAMEKEEPER_EXPORT_FIELDS,
  flamekeepersToCsv,
} from '@/lib/admin/csv'
import { flamekeeperQueries } from '@/lib/flamekeeper/queries'
import {
  flamekeeperStatus,
  type AdminFlamekeeperRow,
} from '@/lib/flamekeeper/types'

interface ExportFlamekeepersDialogProps {
  search?: string
  status?: string[]
  className?: string
}

export function ExportFlamekeepersDialog({
  search,
  status,
  className,
}: ExportFlamekeepersDialogProps) {
  const queryClient = useQueryClient()

  return (
    <ExportCsvDialog
      className={className}
      noun="flamekeeper"
      description="Download a CSV of all flamekeepers matching the current filters. The export includes every matching flamekeeper, not just the current page."
      fields={FLAMEKEEPER_EXPORT_FIELDS}
      defaultKeys={DEFAULT_FLAMEKEEPER_EXPORT_KEYS}
      fileName="flamekeepers-export.csv"
      load={async () => {
        const query = flamekeeperQueries.adminList({ search })
        const rows =
          queryClient.getQueryData<AdminFlamekeeperRow[]>(query.queryKey) ??
          (await queryClient.fetchQuery(query))
        if (!status?.length) return rows
        return rows.filter((row) => status.includes(flamekeeperStatus(row)))
      }}
      toCsv={flamekeepersToCsv}
    />
  )
}
