import { Button } from '@/components/ui/button'

interface SaveBarProps {
  onSave: () => void
  pending: boolean
  disabled?: boolean
}

export function SaveBar({ onSave, pending, disabled }: SaveBarProps) {
  return (
    <div className="flex justify-end">
      <Button onClick={onSave} disabled={pending || disabled}>
        {pending ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  )
}
