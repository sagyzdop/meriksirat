import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useIsMobile } from '@/hooks/use-mobile'
import { birthdayQueries } from '@/lib/birthdays/queries'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'

const STORAGE_KEY_PREFIX = 'meriksirat:birthday-wish-shown'

// Scoped per user so two members sharing a browser each get their own
// once-per-session flag.
function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}:${userId}`
}

function hasShownWish(userId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(storageKey(userId)) === 'true'
  } catch {
    return false
  }
}

function markWishShown(userId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(storageKey(userId), 'true')
  } catch {
    // sessionStorage may be unavailable (e.g. private browsing)
  }
}

export function BirthdayWishDrawer({ userId }: { userId: string }) {
  const [open, setOpen] = React.useState(false)
  const isDesktop = !useIsMobile()
  const { data: message } = useQuery(birthdayQueries.wishMessage(userId))

  React.useEffect(() => {
    // Wait for the birthday check to resolve before deciding anything.
    if (message === undefined) return
    if (message === null) {
      setOpen(false)
      return
    }
    if (hasShownWish(userId)) return
    setOpen(true)
    markWishShown(userId)
  }, [message, userId])

  if (!message) return null

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Happy Birthday!</DialogTitle>
            <DialogDescription className="pt-2 text-base">
              {message}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <DialogClose asChild>
              <Button variant="outline">Thank You!</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Happy Birthday!</DrawerTitle>
          <DrawerDescription className="pt-1 text-base">
            {message}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button>Thank You!</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
