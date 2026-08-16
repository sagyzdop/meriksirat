import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, Eye, ImageIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  availabilityBadgeClass,
  availabilityBadgeLabel,
} from './availability-status'
import { Equipment, EquipmentAvailabilityStatus } from './types'

interface EquipmentCardProps {
  equipment: Equipment
  isSelected?: boolean
  disabled?: boolean
  availabilityStatus?: EquipmentAvailabilityStatus
  onToggleSelect?: (equipmentId: number) => void
}

export function EquipmentCard({
  equipment,
  isSelected = false,
  disabled = false,
  availabilityStatus = 'available',
  onToggleSelect,
}: EquipmentCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const showPlaceholder = imageFailed || !equipment.imagePath

  const isAvailable = equipment.isActive !== false

  const canSelect = isAvailable && availabilityStatus !== 'in-booking'

  return (
    <Card
      className={cn(
        'group relative mx-auto flex w-full flex-col overflow-hidden pt-0 transition-all hover:shadow-lg @container',
        isSelected && 'ring-2 ring-primary/40',
        disabled && 'opacity-60'
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-muted">
        {showPlaceholder ? (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
          </div>
        ) : (
          <img
            src={`/api/images/${equipment.imagePath}`}
            alt={equipment.modelName}
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-contain transition-transform group-hover:scale-105"
          />
        )}
      </div>

      <CardHeader>
        <CardAction>
          <Badge className={availabilityBadgeClass[availabilityStatus]}>
            {availabilityBadgeLabel[availabilityStatus]}
          </Badge>
        </CardAction>
        <CardTitle className="line-clamp-1">{equipment.modelName}</CardTitle>
        <CardContent className="p-0">
          <CardDescription className="line-clamp-2">
            {equipment.description}
          </CardDescription>
        </CardContent>
      </CardHeader>

      <CardFooter className="mt-auto flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link
            to="/equipment/$"
            params={{ _splat: equipment.id.toString() }}
            aria-label={`View details for ${equipment.modelName}`}
          >
            <Eye className="@[17rem]:mr-2 h-4 w-4" />
            <span className="hidden @[17rem]:inline">Details</span>
          </Link>
        </Button>
        <Button
          variant={isSelected ? 'default' : 'outline'}
          className="flex-1"
          disabled={!canSelect}
          onClick={() => onToggleSelect?.(equipment.id)}
          title={
            isSelected
              ? 'Selected'
              : availabilityStatus === 'in-booking'
                ? 'In booking'
                : 'Select'
          }
        >
          <Check className="@[17rem]:mr-2 h-4 w-4" />
          <span className="hidden @[17rem]:inline">
            {isSelected
              ? 'Selected'
              : availabilityStatus === 'in-booking'
                ? 'In booking'
                : 'Select'}
          </span>
        </Button>
      </CardFooter>
    </Card>
  )
}
