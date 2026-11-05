import { useEffect, useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { Flame } from 'lucide-react'
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
  showFlamekeeperInvitation,
  type FlamekeeperInvitationUser,
} from '@/lib/access/access-rules'

const STORAGE_KEY = 'meriksirat:flamekeeper-invitation-dismissed'

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
  const pathname = useLocation({ select: (location) => location.pathname })
  const onPage = pathname.startsWith('/become-flamekeeper')
  const eligible = user === null || showFlamekeeperInvitation(user)

  useEffect(() => {
    if (eligible && !onPage && !wasDismissed()) setOpen(true)
  }, [eligible, onPage])

  const dismiss = () => {
    setOpen(false)
    rememberDismissed()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent>
        <DialogHeader>
          <Flame className="size-8 text-primary" />
          <DialogTitle>Keep the flame alive</DialogTitle>
          <DialogDescription>
            Lend a little of your NU Drive to the club&apos;s albums. It takes a
            minute, and you can stop whenever you like.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={dismiss}>
            Maybe later
          </Button>
          <Button asChild onClick={dismiss}>
            <Link to="/become-flamekeeper">Become a flamekeeper</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
