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
  ALBUM_EXPORT_FIELDS,
  DEFAULT_ALBUM_EXPORT_KEYS,
  albumsToCsv,
  type AlbumExportFieldKey,
} from '@/lib/admin/csv'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import type { AdminAlbumExport } from '@/lib/admin/dashboard-types'
import { cn } from '@/lib/utils'

interface ExportAlbumsDialogProps {
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

export function ExportAlbumsDialog({ className }: ExportAlbumsDialogProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [selectedKeys, setSelectedKeys] = React.useState<AlbumExportFieldKey[]>(
    [...DEFAULT_ALBUM_EXPORT_KEYS]
  )
  const [isExporting, setIsExporting] = React.useState(false)

  const toggleKey = (key: AlbumExportFieldKey) => {
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
      const query = adminDashboardQueries.albumExport()
      let albums = queryClient.getQueryData<AdminAlbumExport[]>(query.queryKey)
      if (!albums) {
        albums = await queryClient.fetchQuery(query)
      }
      const csv = albumsToCsv(albums, selectedKeys)
      downloadCsv(csv, 'albums-export.csv')
      toast.success(
        `Exported ${albums.length} album${albums.length === 1 ? '' : 's'}`
      )
      setOpen(false)
    } catch (error) {
      toast.error('Failed to export albums', {
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
          Export Albums
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Albums</DialogTitle>
          <DialogDescription>
            Download a CSV of all albums. The export includes every album, not
            just the current page.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-md border p-3">
          {ALBUM_EXPORT_FIELDS.map((field) => {
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
