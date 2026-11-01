import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ClubCodeStepProps {
  error: string | null
  isSubmitting: boolean
  onSubmit: (code: string) => void
  onBack?: () => void
}

export function ClubCodeStep({
  error,
  isSubmitting,
  onSubmit,
  onBack,
}: ClubCodeStepProps) {
  const [code, setCode] = useState('')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter the club code</CardTitle>
        <CardDescription>
          Ask a club admin for the current code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (code.trim()) onSubmit(code)
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="clubCode">Club code</Label>
            <Input
              id="clubCode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoFocus
              aria-invalid={error ? true : undefined}
            />
          </div>

          {error && (
            <div className="rounded bg-red-50 p-2 text-center text-sm text-red-600">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || !code.trim()}
          >
            {isSubmitting ? 'Checking...' : 'Continue'}
          </Button>
          {onBack && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={onBack}
              disabled={isSubmitting}
            >
              Back
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
