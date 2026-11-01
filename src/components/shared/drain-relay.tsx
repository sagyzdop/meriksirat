import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatGb } from '@/lib/flamekeeper/rules'
import { relayOnePhoto } from '@/lib/flamekeeper/relay'
import type { DrainStatus } from '@/lib/flamekeeper/types'

interface DrainRelayProps {
  userId?: string
  bytesLeft: number
  drainingDeadline: Date | null
  onFinished: () => void | Promise<void>
}

const MAX_FAILURES_IN_A_ROW = 3

function formatDeadline(d: Date | null): string {
  return d
    ? new Date(d).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'soon'
}

export function DrainRelay({
  userId,
  bytesLeft,
  drainingDeadline,
  onFinished,
}: DrainRelayProps) {
  const [running, setRunning] = useState(false)
  const [left, setLeft] = useState(bytesLeft)
  const [movedBytes, setMovedBytes] = useState(0)
  const [movedCount, setMovedCount] = useState(0)
  const [current, setCurrent] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!running) setLeft(bytesLeft)
  }, [bytesLeft, running])

  useEffect(() => {
    if (!running) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [running])

  useEffect(() => () => abortRef.current?.abort(), [])

  const finish = async (status?: DrainStatus) => {
    if (status) setLeft(status.bytesLeft)
    setRunning(false)
    setCurrent(null)
    abortRef.current = null
    await onFinished()
  }

  const start = async () => {
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setMessage(null)
    let failures = 0
    while (!controller.signal.aborted) {
      try {
        setCurrent('Preparing the next photo...')
        const step = await relayOnePhoto(userId, controller.signal)
        failures = 0
        if (step.kind === 'done') {
          setMessage('All photos have moved. Thank you!')
          await finish(step.status)
          return
        }
        if (step.kind === 'no_space') {
          setMessage(step.message)
          await finish()
          return
        }
        setMovedCount((n) => n + 1)
        setMovedBytes((b) => b + step.bytes)
        setLeft(step.status.bytesLeft)
        setCurrent(`Moved ${step.name}`)
        if (step.status.state !== 'draining') {
          setMessage('All photos have moved. Thank you!')
          await finish(step.status)
          return
        }
      } catch (error) {
        if (controller.signal.aborted) break
        failures++
        if (failures >= MAX_FAILURES_IN_A_ROW) {
          setMessage(
            error instanceof Error
              ? `Moving stopped: ${error.message}`
              : 'Moving stopped after repeated errors'
          )
          await finish()
          return
        }
        await new Promise((r) => setTimeout(r, 1000 * failures))
      }
    }
    await finish()
  }

  const total = movedBytes + left
  const percent = total > 0 ? (movedBytes / total) * 100 : 0

  return (
    <div className="space-y-3 rounded border p-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="font-medium">{formatGb(left)} left to move</span>
        <span className="text-muted-foreground">
          Deadline {formatDeadline(drainingDeadline)}
        </span>
      </div>
      {running && <Progress value={percent} />}
      {running ? (
        <p className="text-muted-foreground">
          Keep this tab open while we move {formatGb(left)}.{' '}
          {movedCount > 0 &&
            `${movedCount} photo${movedCount === 1 ? '' : 's'} moved so far.`}
        </p>
      ) : (
        <p className="text-muted-foreground">
          Photos move through this browser, one at a time. Photos that have not
          moved by the deadline are deleted.
        </p>
      )}
      {current && running && (
        <p className="truncate text-xs text-muted-foreground">{current}</p>
      )}
      {message && <p>{message}</p>}
      {running ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => abortRef.current?.abort()}
        >
          Pause
        </Button>
      ) : (
        <Button size="sm" onClick={start} disabled={left <= 0}>
          Move photos now
        </Button>
      )}
    </div>
  )
}
