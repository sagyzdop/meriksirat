import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, ArrowLeft, Clock, MapPin, User } from "lucide-react";
import type { BookingWithEquipment } from "@/lib/booking/types";
import { cancelBookingFn } from "@/lib/booking";
import { format } from "date-fns";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PageProps {
  booking: BookingWithEquipment;
}

const statusConfig = {
  reserved: { label: "Reserved", variant: "secondary" as const, color: "bg-blue-50 text-blue-700 border-blue-200" },
  awaiting_pickup: { label: "Awaiting Pickup", variant: "default" as const, color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  pending_handover: { label: "Pending Handover", variant: "outline" as const, color: "bg-orange-50 text-orange-700 border-orange-200" },
  returned: { label: "Returned", variant: "secondary" as const, color: "bg-green-50 text-green-700 border-green-200" },
  cancelled: { label: "Cancelled", variant: "destructive" as const, color: "bg-red-50 text-red-700 border-red-200" },
  overdue: { label: "Overdue", variant: "destructive" as const, color: "bg-red-50 text-red-700 border-red-200" },
};

export function Page({ booking }: PageProps) {
  const router = useRouter();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  
  const statusInfo = statusConfig[booking.status as keyof typeof statusConfig] || statusConfig.reserved;
  const startDate = new Date(booking.startTime);
  const endDate = new Date(booking.endTime);

  const handleCancelBooking = async () => {
    setIsCancelling(true);
    try {
      await cancelBookingFn({ data: { bookingId: booking.id } });
      toast.success("Booking cancelled successfully");
      router.invalidate();
      setShowCancelDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel booking");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="bg-background min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <Link to="/bookings">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-foreground text-2xl font-semibold">
                Booking #{booking.id}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusInfo.color}>
                {statusInfo.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Equipment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Equipment Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{booking.equipment?.modelName || 'Unknown Equipment'}</h3>
                {booking.equipment?.description && (
                  <p className="text-muted-foreground">{booking.equipment.description}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking Details Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column - Booking Info */}
          <div className="space-y-6">
            {/* Date & Time */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Booking Period
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Start Time</span>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="font-medium">{format(startDate, "EEEE, MMMM dd, yyyy")}</div>
                    <div className="text-sm text-muted-foreground">{format(startDate, "HH:mm")}</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">End Time</span>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="font-medium">{format(endDate, "EEEE, MMMM dd, yyyy")}</div>
                    <div className="text-sm text-muted-foreground">{format(endDate, "HH:mm")}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Booking Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Booking Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Booking ID</span>
                    <div className="font-medium">#{booking.id}</div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Created</span>
                    <div className="font-medium">{format(new Date(booking.createdAt), "MMM dd, yyyy")}</div>
                  </div>
                </div>
                
                {booking.googleCalendarEventId && (
                  <div>
                    <span className="text-sm text-muted-foreground">Calendar Event</span>
                    <div className="font-medium text-green-600">Synced</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Notes */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {booking.userEventDetails ? (
                  <div className="border-l-4 border-blue-500 pl-4">
                    <p className="text-foreground leading-relaxed">
                      {booking.userEventDetails}
                    </p>
                  </div>
                ) : (
                  <div className="text-muted-foreground italic">
                    No notes provided for this booking.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link 
                  to="/bookings/$bookingId/edit" 
                  params={{ bookingId: booking.id.toString() }}
                >
                  <Button variant="outline" className="w-full">
                    Edit Booking
                  </Button>
                </Link>
                {booking.status === 'reserved' && (
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    Cancel Booking
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel this booking? This action cannot be undone and the calendar event will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCancelling}>Keep Booking</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelBooking}
                disabled={isCancelling}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isCancelling ? "Cancelling..." : "Cancel Booking"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
