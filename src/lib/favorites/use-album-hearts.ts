import * as React from 'react'
import { Debouncer } from '@tanstack/react-pacer'
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

const HEART_MUTATION_KEY = ['album-heart'] as const
const HEART_SEND_WAIT_MS = 400

// Rapid clicks on one album collapse into a single request carrying the final
// state. Kept at module level so a send still goes out if the card unmounts
// (e.g. the user clicks and immediately opens the album).
const pendingSends = new Map<string, Debouncer<(send: () => void) => void>>()

function scheduleSend(albumId: string, send: () => void) {
  let debouncer = pendingSends.get(albumId)
  if (!debouncer) {
    debouncer = new Debouncer(
      (run: () => void) => {
        pendingSends.delete(albumId)
        run()
      },
      { wait: HEART_SEND_WAIT_MS }
    )
    pendingSends.set(albumId, debouncer)
  }
  debouncer.maybeExecute(send)
}

export function useAlbumHearts(
  enabled: boolean
): AlbumHeartsControl | undefined {
  const queryClient = useQueryClient()
  const idsOptions = favoriteQueries.heartedAlbumIds()
  const { data: ids = [] } = useQuery({ ...idsOptions, enabled })

  const { mutate } = useMutation({
    mutationKey: HEART_MUTATION_KEY,
    // One request at a time, so the server applies them in click order.
    scope: { id: 'album-heart' },
    mutationFn: (vars: { albumId: string; hearted: boolean }) =>
      setAlbumHeartFn({ data: vars }),
    onError: (error) => {
      toast.error(errorMessage(error, 'Could not update favorite'))
    },
    onSettled: () => {
      // Refetch once the last queued heart lands; earlier refetches would
      // briefly undo the optimistic state of the clicks still in flight.
      const stillBusy =
        pendingSends.size > 0 ||
        queryClient.isMutating({ mutationKey: HEART_MUTATION_KEY }) > 1
      if (stillBusy) return
      queryClient.invalidateQueries({ queryKey: favoriteQueries.all })
      queryClient.invalidateQueries({ queryKey: albumQueries.all })
    },
  })

  const toggle = React.useCallback(
    (albumId: string) => {
      const current =
        queryClient.getQueryData<string[]>(idsOptions.queryKey) ?? []
      const hearted = !isAlbumHearted(albumId, current)
      void queryClient.cancelQueries({ queryKey: idsOptions.queryKey })
      void queryClient.cancelQueries({ queryKey: albumQueries.all })
      queryClient.setQueryData<string[]>(idsOptions.queryKey, (old) =>
        applyAlbumHeartToggle(old ?? [], albumId, hearted)
      )
      queryClient.setQueriesData({ queryKey: albumQueries.all }, (old) =>
        old === undefined
          ? old
          : patchHeartCount(old, albumId, hearted ? 1 : -1)
      )
      scheduleSend(albumId, () => mutate({ albumId, hearted }))
    },
    [queryClient, idsOptions.queryKey, mutate]
  )

  return React.useMemo(
    () =>
      enabled
        ? {
            isHearted: (albumId) => isAlbumHearted(albumId, ids),
            toggle,
          }
        : undefined,
    [enabled, ids, toggle]
  )
}
