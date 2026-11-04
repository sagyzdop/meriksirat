import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { optOutFlamekeeperFn } from '@/lib/flamekeeper/functions'
import { useAsyncAction } from '@/hooks/use-async-action'

interface StopFlamekeepingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStopped: () => void | Promise<void>
}

export function StopFlamekeepingDialog({
  open,
  onOpenChange,
  onStopped,
}: StopFlamekeepingDialogProps) {
  const { pending: isLoading, run } = useAsyncAction()

  const handleConfirm = () =>
    run(async () => {
      const status = await optOutFlamekeeperFn()
      toast.success(
        status.state === 'drained'
          ? 'You have stopped flamekeeping'
          : 'Your flame is winding down'
      )
      onOpenChange(false)
      await onStopped()
    }, 'Could not stop flamekeeping')

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop flamekeeping?</AlertDialogTitle>
          <AlertDialogDescription>
            Your Drive stops being used for new club photos right away. There is
            nothing else to do on your side, and the app then removes its access
            to your Drive.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Keep going</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void handleConfirm()
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Stopping...' : 'Stop flamekeeping'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
