import { useState } from 'react'
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
import { toast } from 'sonner'

import { User } from '@/lib/user/types'

interface DeactivateUserDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm?: (userId: string) => Promise<void>
}

export function DeactivateUserDialog({
  user,
  open,
  onOpenChange,
  onConfirm,
}: DeactivateUserDialogProps) {
  const [isDeactivating, setIsDeactivating] = useState(false)

  const handleDeactivate = async () => {
    if (!user) return

    setIsDeactivating(true)
    try {
      if (onConfirm) {
        await onConfirm(user.id)
      }
      const displayName =
        [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
      toast.success('User deactivated successfully', {
        description: `${displayName} has been deactivated.`,
      })
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to deactivate user', {
        description:
          error instanceof Error ? error.message : 'An error occurred',
      })
    } finally {
      setIsDeactivating(false)
    }
  }

  const displayName =
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
    user?.email ||
    'this user'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to deactivate this user?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will deactivate <strong>{displayName}</strong> and revoke their
            access to the system. They will no longer be able to log in or
            access any resources. This action can be reversed by reactivating
            the user later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeactivating}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDeactivate()
            }}
            disabled={isDeactivating}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeactivating ? 'Deactivating...' : 'Deactivate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
