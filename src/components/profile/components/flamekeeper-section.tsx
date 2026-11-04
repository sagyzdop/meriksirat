import { useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Progress } from '@/components/ui/progress'
import { useAsyncAction } from '@/hooks/use-async-action'
import {
  confirmGraduationFn,
  startDriveConnectFn,
} from '@/lib/flamekeeper/functions'
import { flamekeeperPresentation } from '@/lib/flamekeeper/profile-copy'
import { graduationMonthFromDate } from '@/lib/graduation-date'
import type { AccessRules } from '@/lib/access/access-rules'
import type { MyFlamekeeper } from '@/lib/flamekeeper/types'
import type { UserProfile } from '@/lib/user/types'
import { BecomeFlamekeeperButton } from './become-flamekeeper-dialog'
import { EditPledgeDialog } from './edit-pledge-dialog'
import { FlameIcon } from './flame-icon'
import { ProfileField } from './profile-field'
import { StopFlamekeepingDialog } from './stop-flamekeeping-dialog'

interface FlamekeeperSectionProps {
  user: UserProfile
  flamekeeper: MyFlamekeeper | null
  rules: AccessRules
  connectError?: string | null
  justConnected?: boolean
}

export function FlamekeeperSection({
  user,
  flamekeeper,
  rules,
  connectError,
  justConnected,
}: FlamekeeperSectionProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [stopOpen, setStopOpen] = useState(false)
  const { pending: isReconnecting, run: runReconnect } = useAsyncAction()
  const { pending: isConfirming, run: runConfirm } = useAsyncAction()
  const view = flamekeeperPresentation(flamekeeper)

  useEffect(() => {
    if (justConnected) toast.success('Drive connected. Thank you!')
  }, [justConnected])

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['flamekeepers'] })
    await router.invalidate()
  }

  const reconnect = () =>
    runReconnect(
      async () => {
        const { url } = await startDriveConnectFn({
          data: { mode: 'reconnect' },
        })
        window.location.assign(url)
      },
      'Could not reconnect Drive',
      { keepPendingOnSuccess: true }
    )

  const confirmGraduation = () =>
    runConfirm(async () => {
      await confirmGraduationFn({ data: {} })
      await refresh()
      toast.success('Graduation date confirmed')
    }, 'Could not confirm the date')

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Flamekeeper</h2>
      <Item variant="muted">
        <ItemMedia>
          <FlameIcon state={view.icon} />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="text-base">{view.title}</ItemTitle>
          <ItemDescription>{view.description}</ItemDescription>
          {connectError && (
            <p role="alert" className="text-sm text-destructive">
              {connectError}
            </p>
          )}
        </ItemContent>
        {view.action === 'become' && rules.canBecomeFlamekeeper && (
          <ItemActions>
            <BecomeFlamekeeperButton
              graduationDate={user.graduationDate}
              error={connectError ?? null}
            />
          </ItemActions>
        )}
        {view.action === 'reconnect' && (
          <ItemActions>
            <Button size="sm" onClick={reconnect} disabled={isReconnecting}>
              {isReconnecting ? 'Redirecting...' : 'Reconnect Drive'}
            </Button>
          </ItemActions>
        )}
      </Item>

      {view.pledge && (
        <Item variant="outline" size="sm">
          <ItemContent>
            <ItemTitle>{view.pledge.line}</ItemTitle>
            <Progress value={view.pledge.percent} className="h-1" />
          </ItemContent>
          {rules.canEditPledge && flamekeeper && (
            <ItemActions>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
              <EditPledgeDialog
                key={flamekeeper.pledgedBytes}
                open={editOpen}
                onOpenChange={setEditOpen}
                pledgedBytes={flamekeeper.pledgedBytes}
                graduationDate={user.graduationDate}
                onSaved={refresh}
              />
            </ItemActions>
          )}
        </Item>
      )}

      {rules.graduationUnderFlamekeeper && (
        <ProfileField
          key={`graduationDate:${user.graduationDate ?? ''}`}
          fieldKey="graduationDate"
          label="Graduating"
          type="month"
          value={user.graduationDate ?? ''}
        />
      )}

      {flamekeeper?.graduationConfirmDue && (
        <Item variant="outline" size="sm">
          <ItemContent>
            <ItemTitle>
              Still graduating in{' '}
              {graduationMonthFromDate(flamekeeper.graduationDate)}?
            </ItemTitle>
            <ItemDescription>
              Confirm your graduation month once a year.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              size="sm"
              variant="outline"
              onClick={confirmGraduation}
              disabled={isConfirming}
            >
              {isConfirming ? 'Saving...' : 'Yes'}
            </Button>
          </ItemActions>
        </Item>
      )}

      {rules.canStopFlamekeeping && (
        <Item variant="outline" size="sm">
          <ItemContent>
            <ItemTitle className="font-normal">Stop flamekeeping</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Button size="sm" variant="ghost" onClick={() => setStopOpen(true)}>
              Stop
            </Button>
          </ItemActions>
          <StopFlamekeepingDialog
            open={stopOpen}
            onOpenChange={setStopOpen}
            onStopped={refresh}
          />
        </Item>
      )}
    </section>
  )
}
