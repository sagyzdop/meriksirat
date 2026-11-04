import { useState } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item'
import { submitClubCodeFn } from '@/lib/auth/onboarding'

export function JoinClubItem() {
  const router = useRouter()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await submitClubCodeFn({ data: { code } })
      if (result.success) {
        await router.invalidate()
        await navigate({ to: '/onboarding' })
        return
      }
      setError('That code is not correct. Check it and try again.')
    } catch {
      setError('Could not check the code. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Item variant="outline" size="sm">
      <ItemContent className="min-w-40">
        <ItemTitle>Join the club</ItemTitle>
        <ItemDescription>Enter the club code.</ItemDescription>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </ItemContent>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (code.trim()) void handleSubmit()
        }}
      >
        <Input
          aria-label="Club code"
          placeholder="Club code"
          className="w-32"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
        />
        <Button type="submit" size="sm" disabled={isSubmitting || !code.trim()}>
          {isSubmitting ? 'Checking...' : 'Join'}
        </Button>
      </form>
    </Item>
  )
}
