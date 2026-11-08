import { Heart } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { AlbumCard } from '@/components/albums/album-card'
import { favoriteQueries } from '@/lib/favorites'

export function Page() {
  const { data: albums = [], isLoading } = useQuery(
    favoriteQueries.heartedAlbums()
  )

  if (isLoading) return <Skeleton className="h-64 w-full" />

  if (albums.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Heart />
          </EmptyMedia>
          <EmptyTitle>No favorite albums yet</EmptyTitle>
          <EmptyDescription>
            Tap the heart on an album to save it here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {albums.map((album) => (
        <AlbumCard key={album.id} album={album} />
      ))}
    </div>
  )
}
