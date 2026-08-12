import { Badge } from "@/components/ui/badge";
import { isPast } from "date-fns";
import { AlertCircle } from "lucide-react";
import type { BookingStatus } from "@/lib/booking/types";
import { cn } from "@/lib/utils";

export interface BookingStatusConfigEntry {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  color: string;
}

export const bookingStatusConfig: Record<BookingStatus, BookingStatusConfigEntry> = {
  booked: { label: "Booked", variant: "secondary", color: "bg-blue-50 text-blue-700 border-blue-200" },
  active: { label: "Active", variant: "default", color: "bg-green-50 text-green-700 border-green-200" },
  returned: { label: "Returned", variant: "secondary", color: "bg-slate-50 text-slate-700 border-slate-200" },
  cancelled: { label: "Cancelled", variant: "destructive", color: "bg-red-50 text-red-700 border-red-200" },
  overdue: { label: "Overdue", variant: "destructive", color: "bg-red-50 text-red-700 border-red-200" },
  partially_returned: { label: "Partially Returned", variant: "default", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

export function getBookingStatusConfig(status: string): BookingStatusConfigEntry {
  return bookingStatusConfig[status as BookingStatus] ?? bookingStatusConfig.booked;
}

export function isBookingOverdue(
  endTime: Date | string,
  status: string
): boolean {
  return (
    isPast(new Date(endTime)) &&
    (status === "active" || status === "partially_returned")
  );
}

export function getDisplayBookingStatus(endTime: Date | string, status: string): BookingStatus {
  return isBookingOverdue(endTime, status) ? "overdue" : (status as BookingStatus);
}

interface BookingStatusBadgeProps {
  status: string;
  endTime?: Date | string;
  showOverdueIcon?: boolean;
  colorized?: boolean;
  className?: string;
}

/**
 * BookingStatusBadge renders a consistent status badge for bookings.
 * When endTime is provided, past-due booked/active/partially_returned bookings
 * are displayed as "overdue".
 */
export function BookingStatusBadge({
  status,
  endTime,
  showOverdueIcon = false,
  colorized = false,
  className,
}: BookingStatusBadgeProps) {
  const displayStatus = endTime != null ? getDisplayBookingStatus(endTime, status) : status;
  const config = getBookingStatusConfig(displayStatus);
  const isOverdue = endTime != null && isBookingOverdue(endTime, status);

  return (
    <Badge
      variant={config.variant}
      className={cn(colorized && config.color, "w-fit", className)}
    >
      {isOverdue && showOverdueIcon && <AlertCircle className="h-3 w-3" aria-hidden="true" />}
      {config.label}
    </Badge>
  );
}
