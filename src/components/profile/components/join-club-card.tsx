import { useState } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { ClubCodeStep } from '@/components/onboarding/components/club-code-step'
import { submitClubCodeFn } from '@/lib/auth/onboarding'

export function JoinClubCard() {
  const router = useRouter()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (code: string) => {
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
    <ClubCodeStep
      error={error}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
    />
  )
}
