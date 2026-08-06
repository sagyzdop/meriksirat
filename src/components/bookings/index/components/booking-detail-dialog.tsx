import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookingWithItems } from "@/lib/booking/types"
import { format } from "date-fns"
import { Calendar, Clock, FileText, Package, AlertCircle } from "lucide-react"
import { CancelBookingDialog } from "./cancel-booking-dialog"

interface BookingDetailDialogProps {
  booking: BookingWithItems | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const statusConfig = {
  booked: { label: "Booked", variant: "secondary" as const },
  active: { label: "Active", variant: "default" as const },
  returned: { label: "Returned", variant: "secondary" as const },
  cancelled: { label: "Cancelled", variant: "destructive" as const },
  overdue: { label: "Overdue", variant: "destructive" as const },
  partially_returned: { label: "Partially Returned", variant: "default" as const },
}

export function BookingDetailDialog({
  booking,
  open,
  onOpenChange,
}: BookingDetailDialogProps) {
  const [showCancelDialog, setShowCancelDialog] = React.useState(false)

  if (!booking) return null

  const status = booking.status as string
  const config = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.booked
  const canCancel = status === "booked" || status === "active"

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Booking Details
              <Badge variant={config.variant}>{config.label}</Badge>
            </DialogTitle>
            <DialogDescription>
              Booking ID: #{booking.id}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Equipment Information */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4" />
                Equipment
              </div>
              <div className="rounded-lg border p-4 space-y-1">
                {booking.items.length === 0 && (
                  <p className="text-muted-foreground text-sm">No items</p>
                )}
                {booking.items.map((item) => (
                  <div key={item.id}>
                    <p className="font-medium">{item.equipment?.modelName ?? `Equipment ${item.equipmentId}`}</p>
                    {item.equipment?.description && (
                      <p className="text-sm text-muted-foreground">
                        {item.equipment.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Booking Period */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Calendar className="h-4 w-4" />
                  Start Time
                </div>
                <div className="rounded-lg border p-4">
                  <p className="font-medium">
                    {format(new Date(booking.startTime), "MMMM dd, yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(booking.startTime), "HH:mm")}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="h-4 w-4" />
                  End Time
                </div>
                <div className="rounded-lg border p-4">
                  <p className="font-medium">
                    {format(new Date(booking.endTime), "MMMM dd, yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(booking.endTime), "HH:mm")}
                  </p>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4" />
                Notes
              </div>
              <div className="rounded-lg border p-4">
                {booking.userEventDetails ? (
                  <p className="text-sm">{booking.userEventDetails}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No notes provided</p>
                )}
              </div>
            </div>

            {/* Booking Metadata */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertCircle className="h-4 w-4" />
                Booking Information
              </div>
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">
                    {format(new Date(booking.createdAt), "MMM dd, yyyy HH:mm")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated:</span>
                  <span className="font-medium">
                    {format(new Date(booking.updatedAt), "MMM dd, yyyy HH:mm")}
                  </span>
                </div>
                {booking.items.some((item) => item.googleCalendarEventId) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Calendar Event:</span>
                    <span className="font-medium">Synced</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {canCancel && (
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={() => setShowCancelDialog(true)}
                >
                  Cancel Booking
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CancelBookingDialog
        booking={booking}
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onSuccess={() => {
          setShowCancelDialog(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}
