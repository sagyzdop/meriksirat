import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { addBookingItemsFn } from '@/lib/booking'

/**
 * useAddBookingItems consumes an `equipmentIds` search param (set when the
 * equipment page is used in add-to-booking mode) and adds those items to the
 * given booking. On success the booking queries are invalidated and the search
 * param is cleared so the flow can be repeated.
 */
export function useAddBookingItems(bookingId: number) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const search = useSearch({ strict: false }) as { equipmentIds?: number[] }
  const processing = useRef(false)

  useEffect(() => {
    const equipmentIds = search.equipmentIds
    if (!equipmentIds || equipmentIds.length === 0) return
    if (processing.current) return
    processing.current = true

    let cancelled = false

    const clearSearch = () => {
      router.navigate({
        to: '.',
        search: (prev) => {
          const next = { ...prev } as Record<string, unknown>
          delete next.equipmentIds
          return next
        },
        replace: true,
      })
    }

    ;(async () => {
      try {
        await addBookingItemsFn({
          data: { bookingId, equipmentIds },
        })
        if (cancelled) return
        toast.success(
          `Added ${equipmentIds.length} item${equipmentIds.length === 1 ? '' : 's'} to this booking`
        )
        await queryClient.invalidateQueries({ queryKey: ['bookings'] })
        router.invalidate()
        clearSearch()
      } catch (error) {
        if (cancelled) return
        if (error instanceof Error && error.message) {
          toast.error(error.message)
        } else {
          toast.error('Failed to add equipment to this booking')
        }
        clearSearch()
      } finally {
        processing.current = false
      }
    })()

    return () => {
      cancelled = true
    }
  }, [bookingId, search.equipmentIds, router, queryClient])
}
