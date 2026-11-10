import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { setFavoriteFn } from './functions'
import { applyFavoriteToggle, isPhotoFavorited } from './logic'
import type { FavoritablePhoto, FavoriteRef } from './logic'
import { favoriteQueries } from './queries'
import { errorMessage } from '@/lib/utils'

export interface FavoritesControl {
  isFavorite: (photo: FavoritablePhoto) => boolean
  toggle: (photo: FavoritablePhoto) => void
}

export function useAlbumFavorites(
  albumId: string,
  enabled: boolean
): FavoritesControl | undefined {
  const queryClient = useQueryClient()
  const options = favoriteQueries.album(albumId)
  const { data: refs = [] } = useQuery({ ...options, enabled })

  const mutation = useMutation({
    mutationFn: (vars: { photo: FavoritablePhoto; favorite: boolean }) =>
      setFavoriteFn({
        data: {
          albumId,
          driveFileId: vars.photo.id,
          favorite: vars.favorite,
        },
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: options.queryKey })
      const previous = queryClient.getQueryData<FavoriteRef[]>(options.queryKey)
      queryClient.setQueryData<FavoriteRef[]>(options.queryKey, (old) =>
        applyFavoriteToggle(old ?? [], vars.photo, vars.favorite)
      )
      return { previous }
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData(options.queryKey, context?.previous)
      toast.error(errorMessage(error, 'Could not update favorite'))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoriteQueries.all })
    },
  })

  const { mutate } = mutation
  return React.useMemo(
    () =>
      enabled
        ? {
            isFavorite: (photo) => isPhotoFavorited(photo, refs),
            toggle: (photo) =>
              mutate({ photo, favorite: !isPhotoFavorited(photo, refs) }),
          }
        : undefined,
    [enabled, refs, mutate]
  )
}
