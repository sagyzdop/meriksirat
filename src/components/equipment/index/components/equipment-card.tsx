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
import { Equipment } from './types'

interface EquipmentCardProps {
  equipment: Equipment
  isSelected?: boolean
  disabled?: boolean
  onToggleSelect?: (equipmentId: number) => void
}

export function EquipmentCard({
  equipment,
  isSelected = false,
  disabled = false,
  onToggleSelect,
}: EquipmentCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const showPlaceholder = imageFailed || !equipment.imagePath

  const isAvailable = equipment.isActive !== false

  return (
    <Card
      className={`group relative mx-auto flex w-full flex-col overflow-hidden pt-0 transition-all hover:shadow-lg${isSelected ? ' ring-2 ring-primary/40' : ''}${disabled ? ' opacity-60' : ''}`}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-t-xl bg-muted">
        {showPlaceholder ? (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
          </div>
        ) : (
          <img
            src={`/api/images/${equipment.imagePath}`}
            alt={equipment.modelName}
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        )}
      </div>

      <CardHeader>
        <CardAction>
          <Badge
            className={
              disabled
                ? 'bg-slate-100 text-slate-700'
                : isAvailable
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-700'
            }
          >
            {disabled
              ? 'In booking'
              : isAvailable
                ? 'Available'
                : 'Unavailable'}
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
          <Link to="/equipment/$" params={{ _splat: equipment.id.toString() }}>
            <Eye className="mr-2 h-4 w-4" />
            Details
          </Link>
        </Button>
        <Button
          variant={isSelected ? 'default' : 'outline'}
          className="flex-1"
          disabled={!isAvailable || disabled}
          onClick={() => onToggleSelect?.(equipment.id)}
        >
          {isSelected && <Check className="mr-2 h-4 w-4" />}
          {isSelected ? 'Selected' : disabled ? 'In booking' : 'Select'}
        </Button>
      </CardFooter>
    </Card>
  )
}
