import { Link } from '@tanstack/react-router'
import { Images, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { authClient } from '@/lib/auth/auth-client'
import type { AlbumSummary } from '@/lib/albums'
import { useAlbumHearts } from '@/lib/favorites/use-album-hearts'
import { albumCoverSrcSet } from '@/lib/albums/urls'
import { albumStorageWarning } from '@/lib/albums/warning'
import { AlbumHeartButton } from './album-heart-button'
import { PhotoImage } from './photo-image'

const ALBUM_CARD_SIZES =
  '(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'

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
    <Card
      size="sm"
      className="group relative mx-auto w-full gap-3 transition-all hover:shadow-lg data-[size=sm]:pt-0 data-[size=sm]:pb-3"
    >
      <Link
        to="/albums/$albumId"
        params={{ albumId: album.id }}
        aria-label={`Open album ${album.title}`}
        className="absolute inset-0 z-10 rounded-xl outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
      />

      <div className="relative aspect-video w-full overflow-hidden rounded-t-xl">
        {album.coverUrl ? (
          <PhotoImage
            src={album.coverUrl}
            srcSet={
              album.coverFileId
                ? albumCoverSrcSet(album.coverFileId)
                : undefined
            }
            sizes={ALBUM_CARD_SIZES}
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
        <CardTitle className="line-clamp-2 min-h-[2lh]">
          {album.title}
        </CardTitle>
        <CardDescription className="line-clamp-2 min-h-[2lh]">
          {album.description}
        </CardDescription>
      </CardHeader>

      <CardFooter className="mt-auto justify-between gap-2 pr-2">
        <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
          <Users className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{authorsLabel}</span>
        </p>
        <AlbumHeartButton
          hearted={hearts?.isHearted(album.id) ?? false}
          count={album.heartCount}
          disabled={!hearts}
          onToggle={() => hearts?.toggle(album.id)}
          className="relative z-20 h-7 shrink-0 px-2"
        />
      </CardFooter>
    </Card>
  )
}
