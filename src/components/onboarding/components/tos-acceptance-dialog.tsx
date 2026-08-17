import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface TosAcceptanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccept: () => void
  isSubmitting: boolean
}

export function TosAcceptanceDialog({
  open,
  onOpenChange,
  onAccept,
  isSubmitting,
}: TosAcceptanceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Terms of Service</DialogTitle>
          <DialogDescription>
            By completing your registration, you agree to our Terms of Service.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            By creating an account and using this Platform, you acknowledge
            that:
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              You have read and agree to the{' '}
              <a
                href="https://github.com/sagyzdop/meriksirat/blob/main/docs/terms-of-service.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Terms of Service
              </a>
            </li>
            <li>
              Your account and data are retained for equipment accountability
              purposes and cannot be deleted by you
            </li>
            <li>
              You are responsible for any content you upload to the Platform
            </li>
            <li>
              You are personally responsible for equipment checked out under
              your account
            </li>
          </ul>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={onAccept} disabled={isSubmitting}>
            {isSubmitting ? 'Completing...' : 'I Agree'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
