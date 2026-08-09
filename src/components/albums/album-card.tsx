import { Link } from '@tanstack/react-router'
import { Images, Link2, Lock } from 'lucide-react'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AlbumSummary } from '@/lib/albums'
import { PhotoImage } from './photo-image'

interface AlbumCardProps {
  album: AlbumSummary
  showOwnership?: boolean
}

export function AlbumCard({ album, showOwnership = true }: AlbumCardProps) {
  return (
    <Card className="group relative mx-auto flex w-full flex-col overflow-hidden pt-0 transition-all hover:shadow-lg">
      <Link
        to="/albums/$albumId"
        params={{ albumId: album.id }}
        aria-label={`Open album ${album.title}`}
        className="relative block aspect-video w-full overflow-hidden rounded-t-xl outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
      >
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
      </Link>

      <CardHeader>
        <CardAction>
          {album.isShared ? (
            <Badge variant="outline" className="w-14 justify-center gap-1">
              <Link2 className="size-3" />
              Public
            </Badge>
          ) : (
            <Badge variant="secondary" className="w-14 justify-center gap-1">
              <Lock className="size-3" />
              Private
            </Badge>
          )}
        </CardAction>
        <CardTitle className="line-clamp-1">{album.title}</CardTitle>
        <CardDescription className="line-clamp-2 min-h-10">
          {album.description || 'No description'}
        </CardDescription>
      </CardHeader>

      <CardFooter className="mt-auto flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link to="/albums/$albumId" params={{ albumId: album.id }}>
            <Images className="size-4" />
            Open album
          </Link>
        </Button>
        {showOwnership && (
          <Badge
            variant={album.ownership === 'owner' ? 'default' : 'secondary'}
            className="w-20 justify-center"
          >
            {album.ownership === 'owner' ? 'Owned' : 'Co-author'}
          </Badge>
        )}
      </CardFooter>
    </Card>
  )
}
