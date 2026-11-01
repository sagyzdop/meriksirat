import { useState } from 'react'
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
import { formatGb } from '@/lib/flamekeeper/rules'

interface StopFlamekeepingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  usedBytes: number
  onStopped: () => void | Promise<void>
}

export function StopFlamekeepingDialog({
  open,
  onOpenChange,
  usedBytes,
  onStopped,
}: StopFlamekeepingDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      const status = await optOutFlamekeeperFn()
      toast.success(
        status.state === 'drained'
          ? 'You have stopped flamekeeping'
          : 'Your photos are now moving to other flamekeepers'
      )
      onOpenChange(false)
      await onStopped()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not stop flamekeeping'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop flamekeeping?</AlertDialogTitle>
          <AlertDialogDescription>
            New uploads stop going to your Drive right away.
            {usedBytes > 0 &&
              ` The ${formatGb(usedBytes)} of club photos you hold move to other flamekeepers through your browser. Photos that have not moved within 14 days are deleted.`}{' '}
            When everything has moved, the app deletes its access to your Drive.
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
