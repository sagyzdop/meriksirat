import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { CalendarEvent } from '@/components/shared/event-calendar'

interface EventDialogProps {
  event: CalendarEvent | null
  isOpen: boolean
  onClose: () => void
  onSave: (event: CalendarEvent) => void
  onDelete: (eventId: string) => void
  readOnly?: boolean
}

export function EventDialog({
  event,
  isOpen,
  onClose,
  onSave,
  onDelete,
  readOnly = false,
}: EventDialogProps) {
  const isReadOnly = readOnly
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (event) {
      setTitle(event.title || '')
      setDescription(event.description || '')
    } else {
      resetForm()
    }
  }, [event])

  const resetForm = () => {
    setTitle('')
    setDescription('')
  }

  const handleSave = () => {
    if (isReadOnly) return
    const eventTitle = title.trim() ? title : '(no title)'
    onSave({
      id: event?.id || '',
      title: eventTitle,
      description,
      start: event?.start || new Date(),
      end: event?.end || new Date(),
      allDay: false,
      color: event?.color || 'sky',
    })
  }

  const handleDelete = () => {
    if (isReadOnly) return
    if (event?.id) {
      onDelete(event.id)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isReadOnly
              ? 'Event Details'
              : event?.id
                ? 'Edit Event'
                : 'Create Event'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isReadOnly
              ? 'View event details'
              : event?.id
                ? 'Edit the details of this event'
                : 'Add a new event to your calendar'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="*:not-first:mt-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isReadOnly}
            />
          </div>
          <div className="*:not-first:mt-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isReadOnly}
            />
          </div>
        </div>
        {isReadOnly ? (
          <DialogFooter className="flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="flex-row sm:justify-between">
            {event?.id && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleDelete}
                aria-label="Delete event"
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            )}
            <div className="flex flex-1 justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
