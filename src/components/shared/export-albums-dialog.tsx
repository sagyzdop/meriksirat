import { useQueryClient } from '@tanstack/react-query'

import { ExportCsvDialog } from '@/components/shared/export-csv-dialog'
import {
  ALBUM_EXPORT_FIELDS,
  DEFAULT_ALBUM_EXPORT_KEYS,
  albumsToCsv,
} from '@/lib/admin/csv'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import type { AdminAlbumExport } from '@/lib/admin/dashboard-types'

export function ExportAlbumsDialog({ className }: { className?: string }) {
  const queryClient = useQueryClient()
  return (
    <ExportCsvDialog
      className={className}
      noun="album"
      description="Download a CSV of all albums. The export includes every album, not just the current page."
      fields={ALBUM_EXPORT_FIELDS}
      defaultKeys={DEFAULT_ALBUM_EXPORT_KEYS}
      fileName="albums-export.csv"
      load={async () => {
        const query = adminDashboardQueries.albumExport()
        return (
          queryClient.getQueryData<AdminAlbumExport[]>(query.queryKey) ??
          queryClient.fetchQuery(query)
        )
      }}
      toCsv={albumsToCsv}
    />
  )
}
