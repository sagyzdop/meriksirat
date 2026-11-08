import * as React from 'react'
import { Heart } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { PhotoGrid } from '@/components/albums/photo-grid'
import { favoriteQueries, setFavoriteFn } from '@/lib/favorites'
import type { FavoritesControl } from '@/lib/favorites/use-album-favorites'
import { errorMessage } from '@/lib/utils'

export function Page() {
  const queryClient = useQueryClient()
  const { data: photos = [], isLoading } = useQuery(favoriteQueries.mine())

  const unfavorite = useMutation({
    mutationFn: (vars: { albumId: string; driveFileId: string }) =>
      setFavoriteFn({ data: { ...vars, favorite: false } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: favoriteQueries.all }),
    onError: (error) =>
      toast.error(errorMessage(error, 'Could not update favorite')),
  })

  const albumByPhoto = React.useMemo(
    () => new Map(photos.map((p) => [p.id, p.albumId])),
    [photos]
  )

  const favorites = React.useMemo<FavoritesControl>(
    () => ({
      isFavorite: () => true,
      toggle: (photo) => {
        const albumId = albumByPhoto.get(photo.id)
        if (!albumId) return
        unfavorite.mutate({ albumId, driveFileId: photo.id })
      },
    }),
    [albumByPhoto, unfavorite]
  )

  return (
    <>
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : photos.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Heart />
            </EmptyMedia>
            <EmptyTitle>No favorites yet</EmptyTitle>
            <EmptyDescription>
              Tap the heart on a photo in any album to save it here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <PhotoGrid
          photos={photos}
          favorites={favorites}
          getAlbumId={(photo) => albumByPhoto.get(photo.id)}
        />
      )}
    </>
  )
}
