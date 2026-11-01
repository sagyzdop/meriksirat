import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FlamekeeperSignupForm } from '@/components/shared/flamekeeper-signup-form'
import { FLAMEKEEPER_EMAIL_DOMAIN } from '@/lib/access/access-rules'
import { isNuEmail } from '@/lib/flamekeeper/rules'

interface FlamekeeperStepProps {
  email: string
  error: string | null
  onBeforeRedirect: () => void
  onBack: () => void
}

export function FlamekeeperStep({
  email,
  error,
  onBeforeRedirect,
  onBack,
}: FlamekeeperStepProps) {
  if (!isNuEmail(email)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Flamekeepers need an NU account</CardTitle>
          <CardDescription>
            You are signed in as {email}. Only {FLAMEKEEPER_EMAIL_DOMAIN}{' '}
            accounts can become flamekeepers, because they come with the NU
            Drive storage the club relies on. Personal Gmail and alumni accounts
            do not qualify.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            To be a flamekeeper, sign out and sign in with your{' '}
            {FLAMEKEEPER_EMAIL_DOMAIN} account. You can still join as a club
            member with the club code.
          </p>
          <Button variant="outline" className="w-full" onClick={onBack}>
            Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flamekeeper details</CardTitle>
        <CardDescription>
          Choose how much storage to pledge, then connect your Drive.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FlamekeeperSignupForm
          error={error}
          onBeforeRedirect={onBeforeRedirect}
          onCancel={onBack}
        />
      </CardContent>
    </Card>
  )
}
