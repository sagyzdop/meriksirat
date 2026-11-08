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
import { useAsyncAction } from '@/hooks/use-async-action'
import { BAN_REASON_MAX } from '@/lib/pool/ban'
import { bulkBanUsersFn } from '@/lib/user'

interface BulkBanUsersDialogProps {
  userIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function BulkBanUsersDialog({
  userIds,
  open,
  onOpenChange,
  onSuccess,
}: BulkBanUsersDialogProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [reason, setReason] = useState('')
  const { pending, run } = useAsyncAction()

  const handleBan = () =>
    run(async () => {
      await bulkBanUsersFn({ data: { userIds, reason } })
      toast.success(`Banned ${userIds.length} member(s)`)
      setReason('')
      onOpenChange(false)
      onSuccess?.()
      await queryClient.invalidateQueries()
      await router.invalidate()
    }, 'Failed to ban members')

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ban {userIds.length} members?</AlertDialogTitle>
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
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason (required)"
          disabled={pending}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(event) => {
              event.preventDefault()
              void handleBan()
            }}
            disabled={pending || !reason.trim()}
          >
            {pending ? 'Banning...' : 'Ban members'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
