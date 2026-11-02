import * as React from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

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
import type { ExportField } from '@/lib/admin/csv'
import { cn } from '@/lib/utils'

interface ExportCsvDialogProps<K extends string, T> {
  noun: string
  description: string
  fields: ExportField<K>[]
  defaultKeys: readonly K[]
  fileName: string
  load: () => Promise<T[]>
  toCsv: (rows: T[], keys: K[]) => string
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
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

export function ExportCsvDialog<K extends string, T>({
  noun,
  description,
  fields,
  defaultKeys,
  fileName,
  load,
  toCsv,
  className,
  open: openProp,
  onOpenChange,
}: ExportCsvDialogProps<K, T>) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }
  const [selectedKeys, setSelectedKeys] = React.useState<K[]>([...defaultKeys])
  const [isExporting, setIsExporting] = React.useState(false)

  const toggleKey = (key: K) => {
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
      const rows = await load()
      downloadCsv(toCsv(rows, selectedKeys), fileName)
      toast.success(
        `Exported ${rows.length} ${noun}${rows.length === 1 ? '' : 's'}`
      )
      setOpen(false)
    } catch (error) {
      toast.error(`Failed to export ${noun}s`, {
        description:
          error instanceof Error ? error.message : 'An error occurred',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const title = `Export ${noun.charAt(0).toUpperCase()}${noun.slice(1)}s`

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className={cn('h-8', className)}>
            <Download className="mr-2 h-4 w-4" />
            {title}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-md border p-3">
          {fields.map((field) => (
            <div key={field.key} className="flex items-center gap-2.5">
              <Checkbox
                id={`export-field-${field.key}`}
                checked={selectedKeys.includes(field.key)}
                onCheckedChange={() => toggleKey(field.key)}
              />
              <Label
                htmlFor={`export-field-${field.key}`}
                className="cursor-pointer font-normal"
              >
                {field.label}
              </Label>
            </div>
          ))}
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
