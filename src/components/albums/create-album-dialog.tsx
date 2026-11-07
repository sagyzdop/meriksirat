import * as React from 'react'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAsyncAction } from '@/hooks/use-async-action'
import { createAlbumFn } from '@/lib/albums'
import { toDateOnlyString } from '@/lib/format'
import {
  AlbumFormFields,
  isAlbumFormComplete,
  type AlbumFormValues,
} from './album-form-fields'

const EMPTY: AlbumFormValues = {
  title: '',
  event: '',
  eventDate: undefined,
  description: '',
}

interface CreateAlbumDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

export function CreateAlbumDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateAlbumDialogProps) {
  const [values, setValues] = React.useState(EMPTY)
  const { pending, run } = useAsyncAction()
  const [submitted, setSubmitted] = React.useState(false)

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const { eventDate } = values
    if (!eventDate) {
      setSubmitted(true)
      return
    }
    void run(async () => {
      await createAlbumFn({
        data: {
          title: values.title.trim(),
          description: values.description.trim() || '',
          event: values.event.trim(),
          eventDate: toDateOnlyString(eventDate),
        },
      })
      toast.success('Album created')
      onOpenChange(false)
      setValues(EMPTY)
      setSubmitted(false)
      onCreated?.()
    }, 'Failed to create album')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New album</DialogTitle>
          <DialogDescription>
            Creates a photo folder in Google Drive.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <AlbumFormFields
            idPrefix="new-album"
            values={values}
            onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
            hints
            eventDateError={submitted}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || !isAlbumFormComplete(values)}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Plus />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
