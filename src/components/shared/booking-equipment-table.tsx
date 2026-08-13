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
  actionsFirst?: boolean;
}

/**
 * BookingEquipmentTable renders the equipment items of a booking as a bare
 * bordered table (image, model name, category).
 *
 * When an action is available, an action column is rendered (first in the
 * table when `actionsFirst` is set):
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
  actionsFirst = false,
}: BookingEquipmentTableProps) {
  const hasActions = Boolean(onCancelItem || telegramBotUsername);

  const canReturn =
    bookingStatus === "active" ||
    bookingStatus === "partially_returned" ||
    bookingStatus === "overdue";

  const renderAction = (item: BookingItemWithEquipment) => {
    if (item.status === "cancelled") {
      return (
        <span className="text-sm text-muted-foreground">Cancelled</span>
      );
    }
    if (item.status === "returned") {
      return <span className="text-sm text-muted-foreground">Returned</span>;
    }
    if (bookingStatus === "booked" && onCancelItem) {
      return (
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onCancelItem(item)}
        >
          Cancel item
        </Button>
      );
    }
    if (canReturn && telegramBotUsername) {
      return (
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
      );
    }
    return null;
  };

  const renderRow = (item: BookingItemWithEquipment) => {
    const equipment = item.equipment;
    const modelName =
      equipment?.modelName ?? `Equipment ${item.equipmentId}`;
    const action = renderAction(item);

    return (
      <TableRow key={item.id}>
        {actionsFirst && hasActions && (
          <TableCell className="whitespace-nowrap">{action}</TableCell>
        )}
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
        {!actionsFirst && hasActions && (
          <TableCell className="whitespace-nowrap">{action}</TableCell>
        )}
      </TableRow>
    );
  };

  return (
    <div className="relative rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {hasActions && actionsFirst && (
              <TableHead className="whitespace-nowrap" />
            )}
            <TableHead className="whitespace-nowrap">Image</TableHead>
            <TableHead className="whitespace-nowrap">Model Name</TableHead>
            <TableHead className="whitespace-nowrap">Category</TableHead>
            {hasActions && !actionsFirst && (
              <TableHead className="whitespace-nowrap" />
            )}
          </TableRow>
        </TableHeader>
        <TableBody>{items.map(renderRow)}</TableBody>
      </Table>
    </div>
  );
}
