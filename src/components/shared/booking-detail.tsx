import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays, Clock, User } from "lucide-react";
import { Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { EquipmentCard } from "./equipment-card";
import { BookingStatusBadge } from "./booking-status-badge";
import type { BookingWithItems } from "@/lib/booking/types";

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
}

/**
 * BookingDetail renders a shared layout for viewing a single booking,
 * used by both the user and admin booking detail pages. Pass userDetails
 * to show the "User Details" card (admin context).
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
}: BookingDetailProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const startDate = new Date(booking.startTime);
  const endDate = new Date(booking.endTime);
  const hasCalendarEvent = booking.items.some((item) => item.googleCalendarEventId);

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
      toast.error(error instanceof Error ? error.message : "Failed to cancel booking");
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
        actions={<BookingStatusBadge status={booking.status} endTime={booking.endTime} colorized />}
      />

      <div className="space-y-8">
        <Section title="Equipment" spacing="compact">
          {booking.items.length > 0 ? (
            <div className="space-y-3">
              {booking.items.map((item) => (
                <EquipmentCard
                  key={item.id}
                  item={{
                    id: item.equipmentId,
                    imagePath: item.equipment?.imagePath ?? null,
                    modelName: item.equipment?.modelName ?? `Equipment ${item.equipmentId}`,
                    description: item.equipment?.description ?? null,
                    category: item.equipment?.category ?? null,
                  }}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Equipment details not available</p>
              </CardContent>
            </Card>
          )}
        </Section>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="size-5" aria-hidden="true" />
                  Booking Period
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm font-medium">Start Time</span>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <div className="font-medium">{format(startDate, "EEEE, MMMM dd, yyyy")}</div>
                    <div className="text-sm text-muted-foreground">{format(startDate, "HH:mm")}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm font-medium">End Time</span>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <div className="font-medium">{format(endDate, "EEEE, MMMM dd, yyyy")}</div>
                    <div className="text-sm text-muted-foreground">{format(endDate, "HH:mm")}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="size-5" aria-hidden="true" />
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

                {hasCalendarEvent && (
                  <div>
                    <span className="text-sm text-muted-foreground">Calendar Event</span>
                    <div className="font-medium text-green-600">Synced</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {userDetails && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="size-5" aria-hidden="true" />
                    User Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Name</span>
                    <div className="font-medium">{userDetails.name}</div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Email</span>
                    <div className="break-all font-medium">{userDetails.email}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {booking.userEventDetails ? (
                  <div className="border-l-4 border-blue-500 pl-4">
                    <p className="leading-relaxed">{booking.userEventDetails}</p>
                  </div>
                ) : (
                  <div className="italic text-muted-foreground">No notes provided for this booking.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link to={editTo} params={{ bookingId: booking.id.toString() }}>
                  <Button variant="outline" className="w-full">
                    {editLabel}
                  </Button>
                </Link>
                {canCancel && onCancel && (
                  <Button variant="destructive" className="w-full" onClick={() => setShowCancelDialog(true)}>
                    Cancel Booking
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>{cancelDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep Booking</AlertDialogCancel>
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
