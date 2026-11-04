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
import { Label } from '@/components/ui/label'
import { updateFlamekeeperFn } from '@/lib/flamekeeper/functions'
import {
  MIN_PLEDGE_BYTES,
  MIN_PLEDGE_GB,
  formatGb,
  bytesToGb,
  isValidPledgeGb,
} from '@/lib/flamekeeper/rules'
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
  const [pledge, setPledge] = useState(
    String(Math.round(bytesToGb(pledgedBytes) * 10) / 10)
  )
  const { pending: isSaving, run } = useAsyncAction()

  const handleSave = async () => {
    const pledgeGb = Number(pledge)
    if (!isValidPledgeGb(pledgeGb)) {
      toast.error(`Pledge at least ${formatGb(MIN_PLEDGE_BYTES)}`)
      return
    }
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
        <div className="space-y-2">
          <Label htmlFor="editPledge">Pledge (GB)</Label>
          <Input
            id="editPledge"
            type="number"
            min={MIN_PLEDGE_GB}
            step="0.5"
            value={pledge}
            onChange={(e) => setPledge(e.target.value)}
          />
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
