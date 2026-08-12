import { Loader2 } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import type { EquipmentWithCategory } from '@/lib/equipment'
import { format } from 'date-fns'

interface BookingConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: EquipmentWithCategory[]
  colorDotFor: (item: EquipmentWithCategory) => string
  selectedDate?: Date
  bookingTimes: { startTime: Date; endTime: Date } | null
  durationMinutes: number
  notes: string
  onNotesChange: (notes: string) => void
  onConfirm: () => void
  isSubmitting: boolean
}

export function BookingConfirmationDialog({
  open,
  onOpenChange,
  equipment,
  colorDotFor,
  selectedDate,
  bookingTimes,
  durationMinutes,
  notes,
  onNotesChange,
  onConfirm,
  isSubmitting,
}: BookingConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Booking</DialogTitle>
          <DialogDescription>
            Please review your booking details and add any notes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Equipment</Label>
            <div className="text-sm text-muted-foreground">
              {equipment.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span
                    className={`inline-flex size-2.5 rounded-full ${colorDotFor(item)}`}
                  />
                  <div>
                    <p className="font-medium">{item.modelName}</p>
                    <p>{item.category?.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Booking Details</Label>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Date:</span>{' '}
                {selectedDate?.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              {bookingTimes && (
                <>
                  <p>
                    <span className="font-medium">Start:</span>{' '}
                    {format(bookingTimes.startTime, 'HH:mm')}
                  </p>
                  <p>
                    <span className="font-medium">End:</span>{' '}
                    {format(bookingTimes.endTime, 'HH:mm')}
                  </p>
                  <p>
                    <span className="font-medium">Duration:</span>{' '}
                    {durationMinutes} minutes
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about your booking..."
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Confirm Booking'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
