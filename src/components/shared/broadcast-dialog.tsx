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
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const MAX_MESSAGE_LENGTH = 4000

type Step = 'compose' | 'confirm' | 'result'

interface BroadcastDialogProps {
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function BroadcastDialog({
  className,
  open: openProp,
  onOpenChange,
}: BroadcastDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  // Controlled when the caller drives the dialog (e.g. a dropdown menu item);
  // otherwise keep the built-in trigger button.
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }
  const [step, setStep] = React.useState<Step>('compose')
  const [message, setMessage] = React.useState('')
  const [isSending, setIsSending] = React.useState(false)
  const [progress, setProgress] = React.useState<{
    linked: number
    processed: number
  } | null>(null)
  const [result, setResult] = React.useState<BroadcastResult | null>(null)

  const reset = React.useCallback(() => {
    setStep('compose')
    setMessage('')
    setIsSending(false)
    setProgress(null)
    setResult(null)
  }, [])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) reset()
  }

  // Sends the broadcast in chunks: each server call delivers a small slice so
  // no single invocation stretches Telegram rate limits or the Worker request
  // budget, while the progress bar shows how far along the fan-out is.
  const handleSend = async () => {
    setIsSending(true)
    setProgress(null)
    setResult(null)

    let offset = 0
    let sentSoFar = 0
    let failedSoFar = 0
    let total = 0
    let linked = 0
    let skipped = 0

    try {
      while (true) {
        const chunk = await broadcastMessage(message, offset)
        total = chunk.total
        linked = chunk.linked
        skipped = chunk.skipped
        sentSoFar += chunk.sent
        failedSoFar += chunk.failed
        const processed = chunk.offset + chunk.sent + chunk.failed
        setProgress({ linked, processed })
        if (chunk.done) break
        offset = chunk.offset + chunk.sent + chunk.failed
      }

      setResult({
        total,
        linked,
        sent: sentSoFar,
        failed: failedSoFar,
        skipped,
        offset: 0,
        done: true,
      })
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
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className={cn('h-8', className)}>
            <Megaphone className="mr-2 h-4 w-4" />
            Broadcast Message
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        {step === 'compose' && (
          <>
            <DialogHeader>
              <DialogTitle>Broadcast Message</DialogTitle>
              <DialogDescription>
                Send a Telegram message to every member with a linked chat. A
                signature line with the recipient's name is appended to each
                message.
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
              {isSending && progress && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Sending…{' '}
                    {Math.min(
                      100,
                      Math.round(
                        (progress.processed / Math.max(1, progress.linked)) *
                          100
                      )
                    )}
                    %
                  </span>
                  <Progress
                    value={Math.min(
                      100,
                      (progress.processed / Math.max(1, progress.linked)) * 100
                    )}
                  />
                </div>
              )}
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
