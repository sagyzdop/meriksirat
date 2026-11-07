import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAsyncAction } from '@/hooks/use-async-action'
import { updateSettingsFn } from '@/lib/admin/functions/settings'

type SettingsPatch = Parameters<typeof updateSettingsFn>[0]['data']

export function useSaveSettings(extraKeys: string[] = []) {
  const queryClient = useQueryClient()
  const { pending, run } = useAsyncAction()

  const save = (data: SettingsPatch) =>
    run(async () => {
      await updateSettingsFn({ data })
      toast.success('Settings updated successfully')
      await Promise.all(
        ['admin-dashboard', ...extraKeys].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] })
        )
      )
    }, 'Failed to update settings')

  return { save, pending }
}
