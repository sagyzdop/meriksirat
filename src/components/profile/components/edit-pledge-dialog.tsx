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
import { Input } from '@/components/ui/input'
import { GraduationMonthInput } from '@/components/shared/graduation-month-input'
import { Label } from '@/components/ui/label'
import { updateFlamekeeperFn } from '@/lib/flamekeeper/functions'
import {
  MIN_PLEDGE_GB,
  bytesToGb,
  isValidPledgeGb,
} from '@/lib/flamekeeper/rules'
import type { MyFlamekeeper } from '@/lib/flamekeeper/types'
import { useAsyncAction } from '@/hooks/use-async-action'

interface EditPledgeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  flamekeeper: MyFlamekeeper
  onSaved: () => Promise<void>
}

export function EditPledgeDialog({
  open,
  onOpenChange,
  flamekeeper,
  onSaved,
}: EditPledgeDialogProps) {
  const [pledge, setPledge] = useState(
    String(Math.round(bytesToGb(flamekeeper.pledgedBytes) * 10) / 10)
  )
  const [graduationDate, setGraduationDate] = useState(
    flamekeeper.graduationDate ?? ''
  )
  const { pending: isSaving, run } = useAsyncAction()

  const handleSave = async () => {
    const pledgeGb = Number(pledge)
    if (!isValidPledgeGb(pledgeGb)) {
      toast.error(`Pledge at least ${MIN_PLEDGE_GB} GB`)
      return
    }
    if (!graduationDate) {
      toast.error('Enter your expected graduation month')
      return
    }
    await run(async () => {
      await updateFlamekeeperFn({ data: { pledgeGb, graduationDate } })
      await onSaved()
      toast.success('Flamekeeper settings updated')
      onOpenChange(false)
    }, 'Update failed')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit pledge</DialogTitle>
          <DialogDescription>
            Lowering your pledge below what is already used moves the excess to
            other flamekeepers instead of rejecting the change.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editPledge">Pledge (GB)</Label>
            <Input
              id="editPledge"
              type="number"
              min={MIN_PLEDGE_GB}
              step="1"
              value={pledge}
              onChange={(e) => setPledge(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editGraduation">Expected graduation month</Label>
            <GraduationMonthInput
              id="editGraduation"
              value={graduationDate}
              onValueChange={setGraduationDate}
            />
          </div>
        </div>
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
