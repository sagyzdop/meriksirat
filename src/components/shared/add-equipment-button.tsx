import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

interface AddEquipmentButtonProps {
  bookingId?: number
  returnTo?: string
  disabled?: boolean
}

export function AddEquipmentButton({
  bookingId,
  returnTo,
  disabled,
}: AddEquipmentButtonProps) {
  if (bookingId) {
    return (
      <Link
        to="/equipment"
        search={{ mode: 'add-to-booking', bookingId, returnTo }}
        disabled={disabled}
      >
        <Button variant="outline" className="w-full sm:w-auto">
          Add More
        </Button>
      </Link>
    )
  }

  return (
    <Link to="/equipment" disabled={disabled}>
      <Button variant="outline" className="w-full sm:w-auto">
        Add More
      </Button>
    </Link>
  )
}
