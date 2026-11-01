import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FavoriteButtonProps {
  favorited: boolean
  onToggle: () => void
  className?: string
  iconClassName?: string
}

export function FavoriteButton({
  favorited,
  onToggle,
  className,
  iconClassName,
}: FavoriteButtonProps) {
  const label = favorited ? 'Remove from favorites' : 'Add to favorites'
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      aria-pressed={favorited}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Heart
        className={cn('size-5', iconClassName)}
        fill={favorited ? 'currentColor' : 'none'}
      />
    </Button>
  )
}
