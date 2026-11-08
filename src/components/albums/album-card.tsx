import { Link } from '@tanstack/react-router'
import { Images, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { authClient } from '@/lib/auth/auth-client'
import type { AlbumSummary } from '@/lib/albums'
import { useAlbumHearts } from '@/lib/favorites/use-album-hearts'
import { albumStorageWarning } from '@/lib/albums/warning'
import { AlbumHeartButton } from './album-heart-button'
import { PhotoImage } from './photo-image'

interface AlbumCardProps {
  album: AlbumSummary
  showWarning?: boolean
}

export function AlbumCard({ album, showWarning }: AlbumCardProps) {
  const { data: session } = authClient.useSession()
  const hearts = useAlbumHearts(!!session?.user)
  const primaryAuthor = album.authors[0]?.name
  const coAuthorCount = Math.max(album.authors.length - 1, 0)
  const authorsLabel = primaryAuthor
    ? `By ${primaryAuthor}${coAuthorCount > 0 ? ` + ${coAuthorCount} more` : ''}`
    : ''

  return (
    <Card className="group relative mx-auto flex w-full flex-col overflow-hidden pt-0 transition-all hover:shadow-lg">
      <Link
        to="/albums/$albumId"
        params={{ albumId: album.id }}
        aria-label={`Open album ${album.title}`}
        className="absolute inset-0 z-10 rounded-xl outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
      />

      <div className="relative block aspect-video w-full overflow-hidden rounded-t-xl">
        {album.coverUrl ? (
          <PhotoImage
            src={album.coverUrl}
            alt={album.title}
            className="transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="bg-muted flex h-full w-full items-center justify-center">
            <Images className="text-muted-foreground/50 size-10" />
          </div>
        )}
        {showWarning && albumStorageWarning(album.eventDate, new Date()) && (
          <Badge
            variant="secondary"
            className="absolute top-2 left-2"
            title="Over 2 years old; may be deleted if storage runs low"
          >
            2+ years
          </Badge>
        )}
      </div>

      <CardHeader>
        <CardTitle className="line-clamp-1 min-h-6">{album.title}</CardTitle>
        <CardDescription className="line-clamp-2 min-h-10">
          {album.description}
        </CardDescription>
        <p className="flex min-h-5 items-center gap-1.5 truncate text-xs text-muted-foreground">
          <Users className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{authorsLabel}</span>
        </p>
      </CardHeader>
      <div className="relative z-20 px-4">
        <AlbumHeartButton
          hearted={hearts?.isHearted(album.id) ?? false}
          count={album.heartCount}
          disabled={!hearts}
          onToggle={() => hearts?.toggle(album.id)}
          className="-ml-2"
        />
      </div>
    </Card>
  )
}
