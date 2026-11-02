import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AlbumDetail } from '@/lib/albums'
import {
  AlbumFormFields,
  isAlbumFormComplete,
  type AlbumFormValues,
} from './album-form-fields'

interface EditAlbumDialogProps {
  album: AlbumDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  busy: boolean
  onSave: (values: AlbumFormValues) => void
}

export function EditAlbumDialog({
  album,
  open,
  onOpenChange,
  busy,
  onSave,
}: EditAlbumDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <EditAlbumForm
          album={album}
          busy={busy}
          onCancel={() => onOpenChange(false)}
          onSave={onSave}
        />
      </DialogContent>
    </Dialog>
  )
}

function EditAlbumForm({
  album,
  busy,
  onCancel,
  onSave,
}: {
  album: AlbumDetail
  busy: boolean
  onCancel: () => void
  onSave: (values: AlbumFormValues) => void
}) {
  const [values, setValues] = React.useState<AlbumFormValues>(() => ({
    title: album.title,
    event: album.event,
    eventDate: album.eventDate ? new Date(album.eventDate) : undefined,
    description: album.description,
  }))

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit album</DialogTitle>
        <DialogDescription>
          Update the title, event, date, and description.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSave(values)
        }}
        className="space-y-4"
      >
        <AlbumFormFields
          idPrefix="album"
          values={values}
          onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !isAlbumFormComplete(values)}>
            {busy ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
