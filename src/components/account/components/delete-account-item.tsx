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
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import { deleteMyAccountFn } from '@/lib/flamekeeper/functions'
import { useAsyncAction } from '@/hooks/use-async-action'

export function DeleteAccountItem() {
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
    <>
      <Item variant="outline" size="sm">
        <ItemContent>
          <ItemTitle className="text-destructive">Delete my account</ItemTitle>
        </ItemContent>
        <ItemActions>
          <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
            Delete
          </Button>
        </ItemActions>
      </Item>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your account and your favorites. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
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
    </>
  )
}
