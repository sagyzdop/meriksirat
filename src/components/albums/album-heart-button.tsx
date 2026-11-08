import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AlbumHeartButtonProps {
  hearted: boolean
  count: number
  disabled?: boolean
  onToggle: () => void
  className?: string
}

export function AlbumHeartButton({
  hearted,
  count,
  disabled,
  onToggle,
  className,
}: AlbumHeartButtonProps) {
  const label = hearted ? 'Remove album from favorites' : 'Favorite this album'
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('gap-1.5 tabular-nums', className)}
      aria-pressed={hearted}
      aria-label={label}
      title={disabled ? 'Sign in to favorite albums' : label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <Heart className="size-4" fill={hearted ? 'currentColor' : 'none'} />
      {count}
    </Button>
  )
}
