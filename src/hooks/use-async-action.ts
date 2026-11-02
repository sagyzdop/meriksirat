import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/utils'

export function useAsyncAction() {
  const [pending, setPending] = useState(false)

  const run = useCallback(
    async (
      action: () => Promise<unknown>,
      errorFallback: string,
      options: { keepPendingOnSuccess?: boolean } = {}
    ) => {
      setPending(true)
      try {
        await action()
        if (!options.keepPendingOnSuccess) setPending(false)
      } catch (error) {
        toast.error(errorMessage(error, errorFallback))
        setPending(false)
      }
    },
    []
  )

  return { pending, run }
}
