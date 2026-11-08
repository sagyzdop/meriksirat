import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { albumQueries } from '@/lib/albums/queries'
import { errorMessage } from '@/lib/utils'
import { setAlbumHeartFn } from './functions'
import { applyAlbumHeartToggle, isAlbumHearted, patchHeartCount } from './logic'
import { favoriteQueries } from './queries'

export interface AlbumHeartsControl {
  isHearted: (albumId: string) => boolean
  toggle: (albumId: string) => void
}

export function useAlbumHearts(
  enabled: boolean
): AlbumHeartsControl | undefined {
  const queryClient = useQueryClient()
  const idsOptions = favoriteQueries.heartedAlbumIds()
  const { data: ids = [] } = useQuery({ ...idsOptions, enabled })

  const mutation = useMutation({
    mutationFn: (vars: { albumId: string; hearted: boolean }) =>
      setAlbumHeartFn({ data: vars }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: idsOptions.queryKey })
      const previousIds = queryClient.getQueryData<string[]>(
        idsOptions.queryKey
      )
      const previousAlbums = queryClient.getQueriesData({
        queryKey: albumQueries.all,
      })
      const delta = vars.hearted ? 1 : -1
      queryClient.setQueryData<string[]>(idsOptions.queryKey, (old) =>
        applyAlbumHeartToggle(old ?? [], vars.albumId, vars.hearted)
      )
      queryClient.setQueriesData({ queryKey: albumQueries.all }, (old) =>
        old === undefined ? old : patchHeartCount(old, vars.albumId, delta)
      )
      return { previousIds, previousAlbums }
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData(idsOptions.queryKey, context?.previousIds)
      for (const [key, data] of context?.previousAlbums ?? []) {
        queryClient.setQueryData(key, data)
      }
      toast.error(errorMessage(error, 'Could not update favorite'))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoriteQueries.all })
      queryClient.invalidateQueries({ queryKey: albumQueries.all })
    },
  })

  const { mutate } = mutation
  return React.useMemo(
    () =>
      enabled
        ? {
            isHearted: (albumId) => isAlbumHearted(albumId, ids),
            toggle: (albumId) =>
              mutate({ albumId, hearted: !isAlbumHearted(albumId, ids) }),
          }
        : undefined,
    [enabled, ids, mutate]
  )
}
