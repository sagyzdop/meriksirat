import * as React from 'react'
import { Megaphone, Send, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { broadcastMessage } from '@/lib/admin/dashboard-queries'
import type { BroadcastResult } from '@/lib/admin/dashboard-types'
import { cn } from '@/lib/utils'

const MAX_MESSAGE_LENGTH = 4000

type Step = 'compose' | 'confirm' | 'result'

interface BroadcastDialogProps {
  className?: string
}

export function BroadcastDialog({ className }: BroadcastDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<Step>('compose')
  const [message, setMessage] = React.useState('')
  const [isSending, setIsSending] = React.useState(false)
  const [result, setResult] = React.useState<BroadcastResult | null>(null)

  const reset = React.useCallback(() => {
    setStep('compose')
    setMessage('')
    setIsSending(false)
    setResult(null)
  }, [])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) reset()
  }

  const handleSend = async () => {
    setIsSending(true)
    try {
      const broadcastResult = await broadcastMessage(message)
      setResult(broadcastResult)
      setStep('result')
    } catch (error) {
      toast.error('Broadcast failed', {
        description:
          error instanceof Error ? error.message : 'An error occurred',
      })
      setStep('confirm')
    } finally {
      setIsSending(false)
    }
  }

  const canCompose =
    message.trim().length > 0 && message.trim().length <= MAX_MESSAGE_LENGTH

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn('h-8', className)}>
          <Megaphone className="mr-2 h-4 w-4" />
          Broadcast Message
        </Button>
      </DialogTrigger>
      <DialogContent>
        {step === 'compose' && (
          <>
            <DialogHeader>
              <DialogTitle>Broadcast Message</DialogTitle>
              <DialogDescription>
                Send a Telegram message to every member with a linked chat. A
                signature with your name is appended automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="broadcast-message">Message</Label>
              <Textarea
                id="broadcast-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Write your announcement..."
                maxLength={MAX_MESSAGE_LENGTH}
                rows={6}
                className="resize-none"
              />
              <div className="flex justify-end">
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    message.trim().length > MAX_MESSAGE_LENGTH
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  )}
                >
                  {message.trim().length}/{MAX_MESSAGE_LENGTH}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={!canCompose}
              >
                <Send className="mr-2 h-4 w-4" />
                Next
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm Broadcast</DialogTitle>
              <DialogDescription>
                This sends the message to every member with a linked Telegram
                chat. It cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  Preview
                </span>
                <div className="mt-1 rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                  {message.trim()}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  Recipients
                </span>
                <p className="mt-1 text-sm">
                  All members with a linked Telegram chat. Members without a
                  linked chat are skipped.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('compose')}
                disabled={isSending}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleSend}
                disabled={isSending}
              >
                <Send className="mr-2 h-4 w-4" />
                {isSending ? 'Sending...' : 'Send Broadcast'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'result' && result && (
          <>
            <DialogHeader>
              <DialogTitle>Broadcast Complete</DialogTitle>
              <DialogDescription>
                Your message was sent to members with a linked Telegram chat.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3">
              <ResultStat
                icon={
                  <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                }
                label="Sent"
                value={result.sent}
              />
              <ResultStat
                icon={
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                }
                label="Failed"
                value={result.failed}
              />
              <ResultStat
                icon={
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                }
                label="Linked accounts"
                value={result.linked}
              />
              <ResultStat
                icon={<XCircle className="h-4 w-4 text-muted-foreground" />}
                label="Skipped (no link)"
                value={result.skipped}
              />
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ResultStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        {icon}
      </div>
      <div>
        <div className="text-lg font-bold leading-none tabular-nums">
          {value.toLocaleString()}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}
