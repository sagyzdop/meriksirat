import { useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Flame } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { FlamekeeperSignupForm } from '@/components/shared/flamekeeper-signup-form'
import { DrainRelay } from '@/components/shared/drain-relay'
import { EditPledgeDialog } from './edit-pledge-dialog'
import { StopFlamekeepingDialog } from './stop-flamekeeping-dialog'
import { getAccessRules } from '@/lib/access/access-rules'
import {
  setLeaderboardAnonymousFn,
  startDriveConnectFn,
} from '@/lib/flamekeeper/functions'
import { FLAMEKEEPER_EMAIL_DOMAIN } from '@/lib/access/access-rules'
import { formatGb } from '@/lib/flamekeeper/rules'
import type { MyFlamekeeper } from '@/lib/flamekeeper/types'
import type { UserProfile } from '@/lib/user/types'

interface FlamekeeperCardProps {
  user: UserProfile
  flamekeeper: MyFlamekeeper | null
  connectError?: string | null
  justConnected?: boolean
}

const STATE_LABEL = {
  active: 'Active',
  full: 'Full',
  draining: 'Draining',
  lost: 'Lost',
  drained: 'Drained',
} as const

export function FlamekeeperCard({
  user,
  flamekeeper,
  connectError,
  justConnected,
}: FlamekeeperCardProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showSignup, setShowSignup] = useState(Boolean(connectError))
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [stopOpen, setStopOpen] = useState(false)

  const rules = getAccessRules({
    isMember: user.isMember,
    role: (user.role as 'user' | 'manager' | 'admin' | null) ?? null,
    email: user.email,
    flamekeeperState: flamekeeper?.state ?? null,
  })

  const handleReconnect = async () => {
    setIsReconnecting(true)
    try {
      const { url } = await startDriveConnectFn({ data: { mode: 'reconnect' } })
      window.location.assign(url)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not reconnect Drive'
      )
      setIsReconnecting(false)
    }
  }

  const handleAnonymousChange = async (anonymous: boolean) => {
    try {
      await setLeaderboardAnonymousFn({ data: { anonymous } })
      await handleSaved()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not update leaderboard'
      )
    }
  }

  const handleSaved = async () => {
    await queryClient.invalidateQueries({ queryKey: ['flamekeepers'] })
    await router.invalidate()
  }

  if (flamekeeper && flamekeeper.state !== 'drained') {
    const percent =
      flamekeeper.pledgedBytes > 0
        ? Math.min(
            100,
            (flamekeeper.usedBytes / flamekeeper.pledgedBytes) * 100
          )
        : 0

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Flame className="size-5" />
                Flamekeeper
              </CardTitle>
              <CardDescription>
                You lend part of your NU Drive storage to keep club photos.
              </CardDescription>
            </div>
            <Badge
              variant={flamekeeper.state === 'lost' ? 'destructive' : 'default'}
            >
              {STATE_LABEL[flamekeeper.state]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {justConnected && (
            <div className="rounded bg-muted p-3 text-sm">
              Drive connected. Thank you for keeping the flame.
            </div>
          )}
          {flamekeeper.state === 'lost' && (
            <div className="space-y-2 rounded bg-red-50 p-3 text-sm text-red-700">
              <p>
                We can no longer reach your Drive. Reconnect within 7 days or
                your photos will drop out of the app.
              </p>
              <Button
                size="sm"
                onClick={handleReconnect}
                disabled={isReconnecting}
              >
                {isReconnecting ? 'Redirecting...' : 'Reconnect Drive'}
              </Button>
            </div>
          )}
          {flamekeeper.state === 'draining' && (
            <div className="space-y-2">
              <p className="text-sm">
                {flamekeeper.drainReason === 'opt_out'
                  ? 'You stopped flamekeeping, so your photos are moving to other flamekeepers. New uploads no longer go to your Drive.'
                  : 'Your pledge is below what you hold, so the excess is moving to other flamekeepers. New uploads no longer go to your Drive.'}
              </p>
              <DrainRelay
                bytesLeft={flamekeeper.drainBytesLeft}
                drainingDeadline={flamekeeper.drainingDeadline}
                onFinished={handleSaved}
              />
            </div>
          )}
          {connectError && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-600">
              {connectError}
            </div>
          )}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>
                {formatGb(flamekeeper.usedBytes)} used of{' '}
                {formatGb(flamekeeper.pledgedBytes)} pledged
              </span>
              <span className="text-muted-foreground tabular-nums">
                {percent.toFixed(0)}%
              </span>
            </div>
            <Progress value={percent} />
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Pledged</dt>
              <dd className="font-medium">
                {formatGb(flamekeeper.pledgedBytes)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Used</dt>
              <dd className="font-medium">{formatGb(flamekeeper.usedBytes)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Expected graduation</dt>
              <dd className="font-medium">{flamekeeper.graduationDate}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Albums hosted</dt>
              <dd className="font-medium">{flamekeeper.albumsHosted}</dd>
            </div>
          </dl>
          <div className="flex items-center gap-3">
            <Switch
              id="leaderboardAnonymous"
              checked={flamekeeper.leaderboardAnonymous}
              onCheckedChange={handleAnonymousChange}
            />
            <Label htmlFor="leaderboardAnonymous">
              Appear as "Anonymous flamekeeper" on the{' '}
              <Link to="/leaderboard" className="underline">
                leaderboard
              </Link>
            </Label>
          </div>
          <div className="flex flex-wrap gap-2">
            {flamekeeper.drainReason !== 'opt_out' && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                Edit pledge
              </Button>
            )}
            {flamekeeper.state !== 'lost' &&
              flamekeeper.drainReason !== 'opt_out' && (
                <Button variant="ghost" onClick={() => setStopOpen(true)}>
                  Stop flamekeeping
                </Button>
              )}
          </div>
          <StopFlamekeepingDialog
            open={stopOpen}
            onOpenChange={setStopOpen}
            usedBytes={flamekeeper.usedBytes}
            onStopped={handleSaved}
          />
          <EditPledgeDialog
            key={`${flamekeeper.pledgedBytes}-${flamekeeper.graduationDate}`}
            open={editOpen}
            onOpenChange={setEditOpen}
            flamekeeper={flamekeeper}
            onSaved={handleSaved}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="size-5" />
          Become a flamekeeper
        </CardTitle>
        <CardDescription>
          Lend part of your NU Google Drive storage to keep club albums alive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!rules.canBecomeFlamekeeper ? (
          <p className="text-sm text-muted-foreground">
            Only {FLAMEKEEPER_EMAIL_DOMAIN} accounts can become flamekeepers.
            You are signed in as {user.email}. Personal Gmail and alumni
            accounts do not have the storage the club relies on.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Switch
                id="becomeFlamekeeper"
                checked={showSignup}
                onCheckedChange={setShowSignup}
              />
              <Label htmlFor="becomeFlamekeeper">Become a flamekeeper</Label>
            </div>
            {showSignup && (
              <FlamekeeperSignupForm error={connectError ?? null} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
