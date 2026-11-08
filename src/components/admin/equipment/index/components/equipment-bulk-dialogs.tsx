import * as React from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { errorMessage } from '@/lib/utils'

interface BulkSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
  title: string
  label: string
  placeholder: string
  options: { value: string; label: string }[]
  successMessage: string
  errorTitle: string
  onSubmit: (value: string) => Promise<void>
  onSuccess?: () => void
}

export function BulkSelectDialog({
  open,
  onOpenChange,
  count,
  title,
  label,
  placeholder,
  options,
  successMessage,
  errorTitle,
  onSubmit,
  onSuccess,
}: BulkSelectDialogProps) {
  const [value, setValue] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) setValue('')
  }, [open])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!value) return
    setSubmitting(true)
    try {
      await onSubmit(value)
      toast.success(successMessage)
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error(errorTitle, {
        description: errorMessage(error, 'An error occurred'),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            This will update {count} selected equipment item(s).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{label}</Label>
            <Select
              value={value}
              onValueChange={setValue}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !value}>
              {submitting ? 'Updating...' : 'Update All'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface BulkDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
  onSubmit: () => Promise<{ deleted: number; skipped: number }>
  onSuccess?: () => void
}

export function BulkDeleteDialog({
  open,
  onOpenChange,
  count,
  onSubmit,
  onSuccess,
}: BulkDeleteDialogProps) {
  const [submitting, setSubmitting] = React.useState(false)

  const handleConfirm = async (event: React.MouseEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      const { deleted, skipped } = await onSubmit()
      toast.success(`${deleted} deleted, ${skipped} skipped (has bookings)`)
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error('Failed to delete equipment', {
        description: errorMessage(error, 'An error occurred'),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {count} equipment item(s)?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the selected equipment. Equipment that has
            booking history will be skipped and left unchanged.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={submitting}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {submitting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
