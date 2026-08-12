import { useState } from "react";
import { format } from "date-fns";
import { Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
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
import { BookingStatusBadge } from "./booking-status-badge";
import { cancelBookingItemFn } from "@/lib/booking";
import type {
  BookingWithItems,
  BookingItemWithEquipment,
} from "@/lib/booking/types";

export interface BookingDetailUserInfo {
  name: string;
  email: string;
}

interface BookingDetailProps {
  booking: BookingWithItems;
  backTo: string;
  backLabel?: string;
  editTo: string;
  editLabel?: string;
  userDetails?: BookingDetailUserInfo | null;
  cancelDescription?: string;
  canCancel?: boolean;
  onCancel?: () => Promise<unknown>;
  canStart?: boolean;
  onStart?: () => Promise<unknown>;
  telegramBotUsername?: string;
}

/**
 * BookingDetail renders a shared layout for viewing a single booking,
 * used by both the user and admin booking detail pages. Pass userDetails
 * to show the "User Details" section (admin context).
 */
export function BookingDetail({
  booking,
  backTo,
  backLabel = "Back",
  editTo,
  editLabel = "Edit Booking",
  userDetails,
  cancelDescription = "Are you sure you want to cancel this booking? This action cannot be undone and the calendar event will be removed.",
  canCancel = false,
  onCancel,
  canStart = false,
  onStart,
  telegramBotUsername,
}: BookingDetailProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [pendingCancelItem, setPendingCancelItem] =
    useState<BookingItemWithEquipment | null>(null);
  const [isCancellingItem, setIsCancellingItem] = useState(false);

  const actualReturn = booking.items.reduce<Date | null>((max, item) => {
    if (!item.returnedAt) return max;
    return !max || item.returnedAt > max ? item.returnedAt : max;
  }, null);

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

  const handleCancelItem = async () => {
    if (!pendingCancelItem) return;
    setIsCancellingItem(true);
    try {
      await cancelBookingItemFn({
        data: { bookingId: booking.id, itemId: pendingCancelItem.id },
      });
      toast.success("Item cancelled successfully");
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      router.invalidate();
      setPendingCancelItem(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel item"
      );
    } finally {
      setIsCancellingItem(false);
    }
  };

  const pendingItemName =
    pendingCancelItem?.equipment?.modelName ??
    (pendingCancelItem
      ? `Equipment ${pendingCancelItem.equipmentId}`
      : "this item");

  return (
    <PageContainer>
      <PageHeader
        title={`Booking #${booking.id}`}
        backTo={backTo}
        backLabel={backLabel}
      />

      <div className="space-y-8">
        <Section title="Details" spacing="compact">
          <div className="relative rounded-md border overflow-x-auto">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    ID
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    #{booking.id}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Status
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <BookingStatusBadge
                      status={booking.status}
                      endTime={booking.endTime}
                      colorized
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Start Time
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {format(
                      new Date(booking.startTime),
                      "EEE, MMM d, yyyy HH:mm"
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    End Time
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(booking.endTime), "EEE, MMM d, yyyy HH:mm")}
                  </TableCell>
                </TableRow>
                {booking.startedAt && (
                  <TableRow>
                    <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                      Actual Start
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(booking.startedAt), "EEE, MMM d, yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                )}
                {actualReturn && (
                  <TableRow>
                    <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                      Actual Return
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(actualReturn), "EEE, MMM d, yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Created At
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {format(
                      new Date(booking.createdAt),
                      "MMM d, yyyy HH:mm"
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Section>

        {booking.items.length > 0 ? (
          <BookingEquipmentTable
            items={booking.items}
            bookingStatus={booking.status}
            telegramBotUsername={telegramBotUsername}
            onCancelItem={setPendingCancelItem}
            disabled={isCancellingItem}
          />
        ) : (
          <div className="relative rounded-md border py-12 text-center text-muted-foreground">
            Equipment details not available
          </div>
        )}

        {userDetails && (
          <Section title="User Details" spacing="compact">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className="text-sm text-muted-foreground">Name</span>
                <div className="font-medium">{userDetails.name}</div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Email</span>
                <div className="break-all font-medium">{userDetails.email}</div>
              </div>
            </div>
          </Section>
        )}

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
          {canCancel && onCancel && (
            <Button
              variant="destructive"
              onClick={() => setShowCancelDialog(true)}
            >
              Cancel Booking
            </Button>
          )}
          <Link to={editTo} params={{ bookingId: booking.id.toString() }}>
            <Button variant="outline">{editLabel}</Button>
          </Link>
        </div>
      </div>

      <AlertDialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Pickup</AlertDialogTitle>
            <AlertDialogDescription>
              Start this booking now? The equipment will be marked as picked up and
              the calendar event will be updated with the actual start time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStarting}>
              Not Now
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStart}
              disabled={isStarting}
            >
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

      <AlertDialog
        open={pendingCancelItem !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCancelItem(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel <strong>{pendingItemName}</strong>{" "}
              from this booking? This action cannot be undone and the calendar
              event for this item will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancellingItem}>
              Keep Item
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelItem}
              disabled={isCancellingItem}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancellingItem ? "Cancelling..." : "Cancel Item"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
