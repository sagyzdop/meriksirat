import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

/**
 * Resolves a stored image reference to a renderable src. User avatars are
 * absolute URLs (e.g. Google OAuth) while R2-backed images are bare keys
 * served through /api/images/{key}.
 */
export function resolveImageSrc(image?: string | null): string | undefined {
  if (!image) return undefined
  if (image.startsWith('http') || image.startsWith('/')) return image
  return `/api/images/${image}`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface UserAvatarProps {
  image?: string | null
  name: string
  className?: string
}

export function UserAvatar({ image, name, className }: UserAvatarProps) {
  return (
    <Avatar className={className}>
      <AvatarImage src={resolveImageSrc(image)} alt={name} />
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  )
}
