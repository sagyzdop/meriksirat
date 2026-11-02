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
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { deleteMyAccountFn } from '@/lib/flamekeeper/functions'
import { useAsyncAction } from '@/hooks/use-async-action'

export function DeleteAccountCard() {
  const [open, setOpen] = useState(false)
  const { pending: isLoading, run } = useAsyncAction()

  const handleConfirm = () =>
    run(
      async () => {
        await deleteMyAccountFn()
        window.location.assign('/')
      },
      'Could not delete the account',
      { keepPendingOnSuccess: true }
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription>
          You are not a club member and are not flamekeeping, so you can delete
          your account for good. Any photos you held have moved and the app no
          longer has access to your Drive.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes your account and your favorites. It cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  void handleConfirm()
                }}
                disabled={isLoading}
              >
                {isLoading ? 'Deleting...' : 'Delete account'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
