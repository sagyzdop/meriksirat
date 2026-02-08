import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TimeSlotPicker, getBookingTimesFromSlots } from "@/components/shared/time-slot-picker"

export interface BulkTimeBookingItem {
  id: number
  equipment?: {
    modelName?: string | null
    googleCalendarId?: string | null
  } | null
}

interface BulkChangeTimeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookings: BulkTimeBookingItem[]
  onConfirm: (startTime: string, endTime: string) => Promise<void>
}

export function BulkChangeTimeDialog({
  open,
  onOpenChange,
  bookings,
  onConfirm,
}: BulkChangeTimeDialogProps) {
  const [selectedSlots, setSelectedSlots] = React.useState<string[]>([])
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const calendarIds = React.useMemo(() => {
    return bookings
      .map((booking) => booking.equipment?.googleCalendarId)
      .filter((id): id is string => Boolean(id))
  }, [bookings])

  const handleConfirm = async () => {
    const times = getBookingTimesFromSlots(selectedSlots, selectedDate)
    if (!times) {
      toast.error("Please select a date and time")
      return
    }

    setIsSubmitting(true)
    try {
      await onConfirm(times.startTime.toISOString(), times.endTime.toISOString())
      setSelectedSlots([])
      setSelectedDate(undefined)
      onOpenChange(false)
    } catch (error: any) {
      console.error("Failed to update bookings:", error)
      toast.error(error?.message || "Failed to update bookings")
    } finally {
      setIsSubmitting(false)
    }
  }

  React.useEffect(() => {
    if (!open) {
      setSelectedSlots([])
      setSelectedDate(undefined)
      setIsSubmitting(false)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Change Booking Time</DialogTitle>
          <DialogDescription>
            Update {bookings.length} booking{bookings.length === 1 ? "" : "s"} to the same time slot.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {calendarIds.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Selected bookings do not have calendars configured.
            </div>
          ) : (
            <TimeSlotPicker
              googleCalendarIds={calendarIds}
              onSlotsChange={(slots, date) => {
                setSelectedSlots(slots)
                setSelectedDate(date)
              }}
              disabled={isSubmitting}
              layout="vertical"
              withCard={false}
            />
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || calendarIds.length === 0 || selectedSlots.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Apply to selected"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
