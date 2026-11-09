import { useEffect, useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { Flame } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  showFlamekeeperInvitation,
  type FlamekeeperInvitationUser,
} from '@/lib/access/access-rules'

const STORAGE_KEY = 'meriksirat:flamekeeper-invitation-dismissed'

const HIDDEN_ON = ['/about', '/become-flamekeeper']

const TITLE = 'Keep the flame alive'
const MESSAGE =
  "Lend a little of your NU Drive to the club's albums. It takes a minute, and you can stop whenever you like."

function wasDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function rememberDismissed() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, 'true')
  } catch {
    // Without storage the dialog simply returns on the next page load.
  }
}

export function FlamekeeperInvitation({
  user,
}: {
  user: FlamekeeperInvitationUser | null
}) {
  const [open, setOpen] = useState(false)
  const isDesktop = !useIsMobile()
  const pathname = useLocation({ select: (location) => location.pathname })
  const onPage = HIDDEN_ON.some((path) => pathname.startsWith(path))
  const eligible = user === null || showFlamekeeperInvitation(user)

  useEffect(() => {
    if (eligible && !onPage && !wasDismissed()) setOpen(true)
  }, [eligible, onPage])

  const dismiss = () => {
    setOpen(false)
    rememberDismissed()
  }

  const onOpenChange = (next: boolean) => {
    if (!next) dismiss()
  }

  const actions = (
    <>
      <Button variant="ghost" onClick={dismiss}>
        Maybe later
      </Button>
      <Button asChild onClick={dismiss}>
        <Link to="/about" hash="flamekeepers">
          Learn more
        </Link>
      </Button>
    </>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <Flame className="text-primary size-8" />
            <DialogTitle>{TITLE}</DialogTitle>
            <DialogDescription className="pt-2 text-base">
              {MESSAGE}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>{actions}</DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <Flame className="text-primary size-8" />
          <DrawerTitle>{TITLE}</DrawerTitle>
          <DrawerDescription className="pt-1 text-base">
            {MESSAGE}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter className="flex-col-reverse">{actions}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
