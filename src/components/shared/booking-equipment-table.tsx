import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createTelegramBotLink } from "@/lib/telegram/client-utils";
import type { BookingItemWithEquipment } from "@/lib/booking/types";

interface BookingEquipmentTableProps {
  items: BookingItemWithEquipment[];
  bookingStatus?: string;
  telegramBotUsername?: string;
  onCancelItem?: (item: BookingItemWithEquipment) => void;
  disabled?: boolean;
}

/**
 * BookingEquipmentTable renders the equipment items of a booking as a bare
 * bordered table (image, model name, category).
 *
 * When an action is available, a trailing column is rendered:
 * - item already cancelled/returned → a plain status label
 * - booking is "booked" → a "Cancel item" button (onCancelItem)
 * - booking is active / partially returned / overdue → a "Return" link that
 *   redirects to the Telegram bot (returns happen through Telegram)
 */
export function BookingEquipmentTable({
  items,
  bookingStatus,
  telegramBotUsername,
  onCancelItem,
  disabled = false,
}: BookingEquipmentTableProps) {
  const hasActions = Boolean(onCancelItem || telegramBotUsername);

  const canReturn =
    bookingStatus === "active" ||
    bookingStatus === "partially_returned" ||
    bookingStatus === "overdue";

  return (
    <div className="relative rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Image</TableHead>
            <TableHead className="whitespace-nowrap">Model Name</TableHead>
            <TableHead className="whitespace-nowrap">Category</TableHead>
            {hasActions && <TableHead className="whitespace-nowrap" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const equipment = item.equipment;
            const modelName =
              equipment?.modelName ?? `Equipment ${item.equipmentId}`;
            return (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap">
                  <img
                    src={
                      equipment?.imagePath
                        ? `/api/images/${equipment.imagePath}`
                        : "/equipment-placeholder.svg"
                    }
                    alt={modelName}
                    className="h-10 w-14 rounded-md border object-cover"
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="font-medium">{modelName}</span>
                    {equipment?.description && (
                      <span className="max-w-[280px] truncate text-sm text-muted-foreground">
                        {equipment.description}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant="outline">
                    {equipment?.category?.name ?? "Uncategorized"}
                  </Badge>
                </TableCell>
                {hasActions && (
                  <TableCell className="whitespace-nowrap">
                    {item.status === "cancelled" && (
                      <span className="text-sm text-muted-foreground">
                        Cancelled
                      </span>
                    )}
                    {item.status === "returned" && (
                      <span className="text-sm text-muted-foreground">
                        Returned
                      </span>
                    )}
                    {item.status !== "cancelled" &&
                      item.status !== "returned" &&
                      bookingStatus === "booked" &&
                      onCancelItem && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={disabled}
                          onClick={() => onCancelItem(item)}
                        >
                          Cancel item
                        </Button>
                      )}
                    {item.status !== "cancelled" &&
                      item.status !== "returned" &&
                      canReturn &&
                      telegramBotUsername && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          disabled={disabled}
                        >
                          <a
                            href={createTelegramBotLink(telegramBotUsername)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open the Telegram bot to return this item. Send /return_equipment."
                          >
                            Return
                          </a>
                        </Button>
                      )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
