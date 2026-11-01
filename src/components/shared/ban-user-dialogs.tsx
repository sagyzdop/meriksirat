import { useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
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
import { Textarea } from '@/components/ui/textarea'
import { banUserFn, unbanUserFn } from '@/lib/user'
import { BAN_REASON_MAX } from '@/lib/pool/ban'

interface DialogProps {
  userId: string
  userName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function useRefreshAfter() {
  const queryClient = useQueryClient()
  const router = useRouter()
  return async () => {
    await queryClient.invalidateQueries()
    await router.invalidate()
  }
}

export function BanUserDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: DialogProps) {
  const refresh = useRefreshAfter()
  const [reason, setReason] = useState('')
  const [isBanning, setIsBanning] = useState(false)

  const handleBan = async () => {
    setIsBanning(true)
    try {
      await banUserFn({ data: { userId, reason } })
      toast.success(`${userName} was banned`)
      setReason('')
      onOpenChange(false)
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to ban user')
    } finally {
      setIsBanning(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ban {userName}?</AlertDialogTitle>
          <AlertDialogDescription>
            They are signed out and can't sign in again, and their upcoming
            bookings are cancelled. Active and overdue bookings stay so the
            return is tracked. Their access to album folders is removed, and any
            photos they hold start moving to other flamekeepers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={reason}
          maxLength={BAN_REASON_MAX}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required)"
          disabled={isBanning}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBanning}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(e) => {
              e.preventDefault()
              void handleBan()
            }}
            disabled={isBanning || !reason.trim()}
          >
            {isBanning ? 'Banning...' : 'Ban user'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function UnbanUserDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: DialogProps) {
  const refresh = useRefreshAfter()
  const [isUnbanning, setIsUnbanning] = useState(false)

  const handleUnban = async () => {
    setIsUnbanning(true)
    try {
      await unbanUserFn({ data: { userId } })
      toast.success(`${userName} was unbanned`)
      onOpenChange(false)
      await refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to unban user'
      )
    } finally {
      setIsUnbanning(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unban {userName}?</AlertDialogTitle>
          <AlertDialogDescription>
            They can sign in again. Bookings that were cancelled stay cancelled,
            and flamekeeping is not restored: they connect Drive again
            themselves.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUnbanning}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void handleUnban()
            }}
            disabled={isUnbanning}
          >
            {isUnbanning ? 'Unbanning...' : 'Unban'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
