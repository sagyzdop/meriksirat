import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { startDriveConnectFn } from '@/lib/flamekeeper/functions'
import {
  FLAMEKEEPER_TERMS_URL,
  TERMS_URL,
  MIN_PLEDGE_GB,
  isValidGraduationDate,
  isValidPledgeGb,
} from '@/lib/flamekeeper/rules'
import { errorMessage } from '@/lib/utils'

interface FlamekeeperSignupFormProps {
  error?: string | null
  onBeforeRedirect?: () => void
}

export function FlamekeeperSignupForm({
  error,
  onBeforeRedirect,
}: FlamekeeperSignupFormProps) {
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [pledge, setPledge] = useState(String(MIN_PLEDGE_GB))
  const [graduationDate, setGraduationDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const pledgeGb = Number(pledge)
    if (!isValidPledgeGb(pledgeGb)) {
      setFormError(`Pledge at least ${MIN_PLEDGE_GB} GB.`)
      return
    }
    if (!isValidGraduationDate(graduationDate)) {
      setFormError('Enter an expected graduation date in the future.')
      return
    }
    if (!termsAccepted) {
      setFormError('Accept the terms to continue.')
      return
    }

    setIsSubmitting(true)
    try {
      const { url } = await startDriveConnectFn({
        data: { mode: 'signup', pledgeGb, graduationDate, termsAccepted: true },
      })
      onBeforeRedirect?.()
      window.location.assign(url)
    } catch (err) {
      setFormError(errorMessage(err, 'Could not start Drive connection.'))
      setIsSubmitting(false)
    }
  }

  const shownError = formError ?? error

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fkPledge">Pledge (GB)</Label>
        <Input
          id="fkPledge"
          type="number"
          min={MIN_PLEDGE_GB}
          step="1"
          value={pledge}
          onChange={(e) => setPledge(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          The most storage the app may use in your Drive. Minimum{' '}
          {MIN_PLEDGE_GB} GB. You can change it later.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fkGraduation">Expected graduation date</Label>
        <Input
          id="fkGraduation"
          type="date"
          min={tomorrow}
          value={graduationDate}
          onChange={(e) => setGraduationDate(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Your photos are moved to other flamekeepers before your account moves
          to alumni.
        </p>
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="fkTerms"
          checked={termsAccepted}
          onCheckedChange={(value) => setTermsAccepted(value === true)}
          className="mt-0.5"
        />
        <Label htmlFor="fkTerms" className="text-sm font-normal leading-snug">
          I have read and accept the{' '}
          <a
            href={TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            terms of service
          </a>{' '}
          and the{' '}
          <a
            href={FLAMEKEEPER_TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            flamekeeper terms
          </a>
          : I own the photos stored with me, I must not edit or delete them, and
          the app may delete them at expiry or when I opt out.
        </Label>
      </div>

      {shownError && (
        <div className="rounded bg-red-50 p-2 text-center text-sm text-red-600">
          {shownError}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Next, Google asks you to let the app manage only the files it creates in
        your Drive. It cannot read the rest of your Drive.
      </p>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Redirecting to Google...' : 'Connect Drive'}
      </Button>
    </form>
  )
}
