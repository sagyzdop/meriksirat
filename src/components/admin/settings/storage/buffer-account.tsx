import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemActions,
} from '@/components/ui/item'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsyncAction } from '@/hooks/use-async-action'
import {
  cancelBufferSwitchFn,
  continueBufferSwitchFn,
  startBufferConnectFn,
} from '@/lib/buffer/account-functions'
import {
  BUFFER_CONNECT_MESSAGES,
  BUFFER_STATE_LABELS,
  type ConnectRefusal,
} from '@/lib/buffer/grant-rules'
import { bufferQueries } from '@/lib/buffer/queries'
import { formatDate } from '@/lib/format'

interface Props {
  connected?: boolean
  connectError?: string
}

export function BufferAccount({ connected, connectError }: Props) {
  const queryClient = useQueryClient()
  const { data } = useQuery(bufferQueries.account())
  const { pending, run } = useAsyncAction()

  if (!data) return <Skeleton className="h-24 w-full" />

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: bufferQueries.all })

  const connect = () =>
    run(
      async () => {
        const { url } = await startBufferConnectFn()
        window.location.href = url
      },
      'Could not start the connection',
      { keepPendingOnSuccess: true }
    )

  const cancel = () =>
    run(async () => {
      await cancelBufferSwitchFn()
      await refresh()
      toast.success('Switch cancelled, copied albums are moving back')
    }, 'Could not cancel the switch')

  const copyMore = () =>
    run(async () => {
      await continueBufferSwitchFn()
      await refresh()
    }, 'Could not copy more albums')

  const refusal =
    connectError && connectError in BUFFER_CONNECT_MESSAGES
      ? BUFFER_CONNECT_MESSAGES[connectError as ConnectRefusal]
      : null
  const switching = data.pending
  const done = switching ? switching.total - switching.remaining : 0

  return (
    <div className="space-y-3">
      {connected ? (
        <Alert>
          <AlertTitle>Account connected</AlertTitle>
          <AlertDescription>
            Google access was saved for the buffer account.
          </AlertDescription>
        </Alert>
      ) : null}
      {refusal ? (
        <Alert variant="destructive">
          <AlertTitle>Could not connect</AlertTitle>
          <AlertDescription>{refusal}</AlertDescription>
        </Alert>
      ) : null}
      {!data.encryptionReady && data.canEdit ? (
        <Alert variant="destructive">
          <AlertTitle>Encryption key missing</AlertTitle>
          <AlertDescription>
            Set the BUFFER_ENCRYPTION_KEY Worker secret before connecting an
            account.
          </AlertDescription>
        </Alert>
      ) : null}

      <ItemGroup className="gap-2">
        <Item variant="outline" size="sm">
          <ItemContent>
            <p className="font-medium">
              {data.active ? data.active.email : 'No buffer account'}
            </p>
            <ItemDescription>
              {data.active
                ? data.active.source === 'environment'
                  ? 'Using the account from the server environment. Reconnect it here to manage it from the app.'
                  : BUFFER_STATE_LABELS[data.active.state]
                : 'Connect a Google account to store album photos.'}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            {data.active ? (
              <Badge
                variant={
                  data.active.state === 'ok' ? 'secondary' : 'destructive'
                }
              >
                {BUFFER_STATE_LABELS[data.active.state]}
              </Badge>
            ) : null}
            {data.canEdit && !switching ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending || !data.encryptionReady}
                onClick={connect}
              >
                {data.active ? 'Change or reconnect' : 'Connect'}
              </Button>
            ) : null}
          </ItemActions>
        </Item>

        {switching ? (
          <Item variant="outline" size="sm" className="flex-col items-stretch">
            <ItemContent>
              <p className="font-medium">Switching to {switching.email}</p>
              <ItemDescription>
                {switching.state === 'ok'
                  ? `${done} of ${switching.total} albums copied. Uploads keep using the current account until every album is copied.`
                  : BUFFER_STATE_LABELS[switching.state]}
              </ItemDescription>
            </ItemContent>
            <Progress
              value={switching.total > 0 ? (done / switching.total) * 100 : 0}
            />
            {data.canEdit ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={copyMore}
                >
                  Copy more now
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" disabled={pending}>
                      Cancel switch
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel the switch?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Albums already copied move back to the current account,
                        reusing their originals there. Copies in the new account
                        are then deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep going</AlertDialogCancel>
                      <AlertDialogAction onClick={cancel}>
                        Cancel switch
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : null}
          </Item>
        ) : null}

        {data.returning ? (
          <Item variant="outline" size="sm">
            <ItemContent>
              <p className="font-medium">Moving albums back</p>
              <ItemDescription>
                {data.returning.remaining} albums are still in a previous
                account and are moving to the current one.
              </ItemDescription>
            </ItemContent>
            {data.canEdit ? (
              <ItemActions>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={copyMore}
                >
                  Move more now
                </Button>
              </ItemActions>
            ) : null}
          </Item>
        ) : null}

        {data.retiring.map((grant) => (
          <Item key={grant.email} variant="outline" size="sm">
            <ItemContent>
              <p className="font-medium">{grant.email}</p>
              <ItemDescription>
                Previous account. Its originals are kept
                {grant.retireAfter
                  ? ` until ${formatDate(new Date(grant.retireAfter))}`
                  : ''}
                , then removed.
              </ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </div>
  )
}
