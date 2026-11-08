import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PledgePicker } from '@/components/shared/pledge-picker'
import { updateFlamekeeperFn } from '@/lib/flamekeeper/functions'
import { DEFAULT_PLEDGE_CHOICE, resolvePledge } from '@/lib/flamekeeper/pledge'
import { bytesToGb } from '@/lib/flamekeeper/rules'
import { useAsyncAction } from '@/hooks/use-async-action'

interface EditPledgeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pledgedBytes: number
  graduationDate: string | null
  onSaved: () => Promise<void>
}

export function EditPledgeDialog({
  open,
  onOpenChange,
  pledgedBytes,
  graduationDate,
  onSaved,
}: EditPledgeDialogProps) {
  const [pledge, setPledge] = useState(() => {
    const current = String(bytesToGb(pledgedBytes))
    return resolvePledge(current).ok ? current : DEFAULT_PLEDGE_CHOICE
  })
  const { pending: isSaving, run } = useAsyncAction()

  const handleSave = async () => {
    const resolved = resolvePledge(pledge)
    if (!resolved.ok) {
      toast.error(resolved.error)
      return
    }
    const pledgeGb = resolved.gb
    if (!graduationDate) {
      toast.error('Enter your graduation month first')
      return
    }
    await run(async () => {
      await updateFlamekeeperFn({ data: { pledgeGb, graduationDate } })
      await onSaved()
      toast.success('Pledge updated')
      onOpenChange(false)
    }, 'Update failed')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit pledge</DialogTitle>
          <DialogDescription>
            How much of your NU Drive you lend to the club.
          </DialogDescription>
        </DialogHeader>
        <PledgePicker value={pledge} onChange={setPledge} />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
