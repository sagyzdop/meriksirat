import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Gift } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { birthdayQueries } from '@/lib/birthdays/queries'
import { DEFAULT_BIRTHDAY_WISH } from '@/lib/birthdays/constants'
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

const STORAGE_KEY = 'meriksirat:birthday-wish-shown'

function hasShownWish(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function markWishShown(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, 'true')
  } catch {
    // sessionStorage may be unavailable (e.g. private browsing)
  }
}

export function BirthdayWishDrawer() {
  const [open, setOpen] = React.useState(false)
  const isDesktop = !useIsMobile()
  const { data: message } = useQuery(birthdayQueries.wishMessage())

  React.useEffect(() => {
    if (hasShownWish()) return
    setOpen(true)
    markWishShown()
  }, [])

  const body = message ?? DEFAULT_BIRTHDAY_WISH

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
                <Gift className="size-5" />
              </div>
              <DialogTitle>Happy Birthday!</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-base">
              {body}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <DialogClose asChild>
              <Button variant="outline">Got it!</Button>
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
          <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
            <Gift className="size-5" />
          </div>
          <DrawerTitle className="pt-2">Happy Birthday!</DrawerTitle>
          <DrawerDescription className="pt-1 text-base">
            {body}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button>Got it!</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
