import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
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
import { BookingEquipmentTable } from "./booking-equipment-table";
import { BookingInfoTable } from "./booking-info-table";
import type { BookingInfoTableBookedBy } from "./booking-info-table";
import { ExtendBookingButton } from "./extend-booking-button";
import type { BookingWithItems } from "@/lib/booking/types";

interface BookingDetailProps {
  booking: BookingWithItems;
  backTo: string;
  backLabel?: string;
  editTo: string;
  editLabel?: string;
  bookedBy?: BookingInfoTableBookedBy | null;
  cancelDescription?: string;
  canCancel?: boolean;
  onCancel?: () => Promise<unknown>;
  canStart?: boolean;
  onStart?: () => Promise<unknown>;
}

/**
 * BookingDetail renders a shared layout for viewing a single booking,
 * used by both the user and admin booking detail pages. Pass bookedBy to
 * show the "Booked by" row with a profile picture (admin context).
 */
export function BookingDetail({
  booking,
  backTo,
  backLabel = "Back",
  editTo,
  editLabel = "Edit Booking",
  bookedBy,
  cancelDescription = "Are you sure you want to cancel this booking? This action cannot be undone and the calendar event will be removed.",
  canCancel = false,
  onCancel,
  canStart = false,
  onStart,
}: BookingDetailProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const editable = booking.status === "booked";

  const handleStart = async () => {
    if (!onStart) return;
    setIsStarting(true);
    try {
      await onStart();
      toast.success("Booking started successfully");
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      router.invalidate();
      setShowStartDialog(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start booking"
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancel = async () => {
    if (!onCancel) return;
    setIsCancelling(true);
    try {
      await onCancel();
      toast.success("Booking cancelled successfully");
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      router.invalidate();
      setShowCancelDialog(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel booking"
      );
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={`Booking #${booking.id}`}
        backTo={backTo}
        backLabel={backLabel}
      />

      <div className="space-y-8">
        <Section title="Details" spacing="compact">
          <BookingInfoTable booking={booking} bookedBy={bookedBy} />
        </Section>

        <Section title="Equipment" spacing="compact">
          {booking.items.length > 0 ? (
            <BookingEquipmentTable items={booking.items} />
          ) : (
            <div className="relative rounded-md border py-12 text-center text-muted-foreground">
              Equipment details not available
            </div>
          )}
        </Section>

        <Section title="Notes" spacing="compact">
          {booking.userEventDetails ? (
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="leading-relaxed">{booking.userEventDetails}</p>
            </div>
          ) : (
            <p className="italic text-muted-foreground">
              No notes provided for this booking.
            </p>
          )}
        </Section>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          {canStart && onStart && (
            <Button
              variant="default"
              onClick={() => setShowStartDialog(true)}
            >
              Start Pickup
            </Button>
          )}
          <ExtendBookingButton
            bookingId={booking.id}
            status={booking.status}
            onExtend={() => router.invalidate()}
          />
          {canCancel && onCancel && (
            <Button
              variant="destructive"
              onClick={() => setShowCancelDialog(true)}
            >
              Cancel Booking
            </Button>
          )}
          {editable && (
            <Link to={editTo} params={{ bookingId: booking.id.toString() }}>
              <Button variant="outline">{editLabel}</Button>
            </Link>
          )}
        </div>
      </div>

      <AlertDialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Pickup</AlertDialogTitle>
            <AlertDialogDescription>
              Start this booking now? The equipment will be marked as picked up
              and the calendar event will be updated with the actual start
              time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStarting}>
              Not Now
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleStart} disabled={isStarting}>
              {isStarting ? "Starting..." : "Start Booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>{cancelDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              Keep Booking
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? "Cancelling..." : "Cancel Booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
