import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createTelegramBotLink } from '@/lib/telegram/client-utils'
import type { BookingItemWithEquipment } from '@/lib/booking/types'

interface BookingItemActionProps {
  item: BookingItemWithEquipment
  bookingStatus: string
  telegramBotUsername?: string
  onCancelItem?: (item: BookingItemWithEquipment) => void
  disabled?: boolean
}

/**
 * BookingItemAction renders the trailing action for a single booking item:
 * - already cancelled/returned → a badge with the item status
 * - booking is "booked" → a "Cancel item" button (onCancelItem)
 * - booking is active / partially returned / overdue → a "Return" link that
 *   redirects to the Telegram bot (returns happen through Telegram)
 */
export function BookingItemAction({
  item,
  bookingStatus,
  telegramBotUsername,
  onCancelItem,
  disabled = false,
}: BookingItemActionProps) {
  if (item.status === 'cancelled') {
    return <Badge variant="destructive">Cancelled</Badge>
  }
  if (item.status === 'returned') {
    return <Badge variant="outline">Returned</Badge>
  }
  if (bookingStatus === 'booked' && onCancelItem) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onCancelItem(item)}
      >
        Cancel item
      </Button>
    )
  }
  const canReturn =
    bookingStatus === 'active' ||
    bookingStatus === 'partially_returned' ||
    bookingStatus === 'overdue'
  if (canReturn && telegramBotUsername) {
    return (
      <Button variant="outline" size="sm" asChild disabled={disabled}>
        <a
          href={createTelegramBotLink(telegramBotUsername)}
          target="_blank"
          rel="noopener noreferrer"
          title="Open the Telegram bot to return this item. Send /return_equipment."
        >
          Return
        </a>
      </Button>
    )
  }
  return null
}
