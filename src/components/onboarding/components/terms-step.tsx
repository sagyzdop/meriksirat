import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { TERMS_URL } from '@/lib/flamekeeper/rules'

interface TermsStepProps {
  error: string | null
  isSubmitting: boolean
  onAccept: () => void
}

export function TermsStep({ error, isSubmitting, onAccept }: TermsStepProps) {
  const [accepted, setAccepted] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          This account has too little Drive storage to keep club photos, so
          there is nothing to connect. You can browse albums and favorite
          photos. If you are a club member, enter the club code on your profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2">
          <Checkbox
            id="signupTerms"
            checked={accepted}
            onCheckedChange={(value) => setAccepted(value === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="signupTerms"
            className="text-sm font-normal leading-snug"
          >
            I have read and accept the{' '}
            <a
              href={TERMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              terms of service
            </a>
            .
          </Label>
        </div>
        {error && (
          <div className="rounded bg-red-50 p-2 text-center text-sm text-red-600">
            {error}
          </div>
        )}
        <Button
          className="w-full"
          disabled={!accepted || isSubmitting}
          onClick={onAccept}
        >
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </Button>
      </CardContent>
    </Card>
  )
}
