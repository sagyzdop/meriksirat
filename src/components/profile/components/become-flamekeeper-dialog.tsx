import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FlamekeeperSignupForm } from '@/components/shared/flamekeeper-signup-form'

interface BecomeFlamekeeperButtonProps {
  graduationDate: string | null
  error: string | null
}

/**
 * The single place the profile's "Become a flamekeeper" action reaches the
 * sign-up flow. #31 replaces this with a link to the dedicated page.
 */
export function BecomeFlamekeeperButton({
  graduationDate,
  error,
}: BecomeFlamekeeperButtonProps) {
  const [open, setOpen] = useState(Boolean(error))

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Become a flamekeeper
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Become a flamekeeper</DialogTitle>
            <DialogDescription>
              Lend a little of your NU Drive to the club's albums.
            </DialogDescription>
          </DialogHeader>
          <FlamekeeperSignupForm
            initialGraduationDate={graduationDate}
            error={error}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
