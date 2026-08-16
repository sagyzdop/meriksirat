import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useRouter } from '@tanstack/react-router'
import {
  updateUserOnboardingFn,
  completeTelegramOnboardingFn,
  getTelegramLinkUrlFn,
} from '@/lib/auth/onboarding'
import { cn } from '@/lib/utils'
import { toDateOnlyString } from '@/lib/format'
import { useState } from 'react'
import { OnboardingHeader } from '@/components/onboarding/components/onboarding-header'
import { ProfileStep } from '@/components/onboarding/components/profile-step'
import { TelegramStep } from '@/components/onboarding/components/telegram-step'

const updateOnboardingSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  birthday: z.date(),
  instagramUsername: z.string().optional(),
  nuId: z.string().min(1, 'NU ID is required'),
  major: z.string().min(1, 'Major is required'),
  graduationYear: z.string().min(1, 'Graduation year is required'),
})

type OnboardingForm = z.infer<typeof updateOnboardingSchema>

type OnboardingStep = 'profile' | 'telegram'

export function Page({ className, ...props }: React.ComponentProps<'div'>) {
  const navigate = useNavigate()
  const router = useRouter()
  const [step, setStep] = useState<OnboardingStep>('profile')
  const [telegramUrl, setTelegramUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCheckingTelegram, setIsCheckingTelegram] = useState(false)

  const form = useForm<OnboardingForm>({
    resolver: zodResolver(updateOnboardingSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      birthday: undefined,
      instagramUsername: '',
      nuId: '',
      major: '',
      graduationYear: '',
    },
  })

  const onSubmit = async (data: OnboardingForm) => {
    try {
      setError(null)
      const result = await updateUserOnboardingFn({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          birthday: toDateOnlyString(data.birthday),
          instagramUsername: data.instagramUsername,
          nuId: parseInt(data.nuId),
          major: data.major,
          graduationYear: parseInt(data.graduationYear),
        },
      })

      if (result.needsTelegramLink) {
        const tokenResult = await getTelegramLinkUrlFn()

        if (tokenResult.isDevelopment) {
          await completeTelegramOnboardingFn({ data: { skipTelegram: true } })
          await router.invalidate()
          await navigate({ to: '/equipment' })
          return
        }

        setStep('telegram')

        if (tokenResult.alreadyLinked) {
          await completeTelegramOnboardingFn({ data: { skipTelegram: false } })
          await router.invalidate()
          navigate({ to: '/equipment' })
        } else {
          setTelegramUrl(tokenResult.url)
        }
      }
    } catch (error) {
      console.error('Onboarding failed:', error)
      setError('Failed to save profile information. Please try again.')
    }
  }

  const handleTelegramLink = () => {
    if (telegramUrl) {
      window.open(telegramUrl, '_blank')
      setIsCheckingTelegram(true)
      checkTelegramStatus()
    }
  }

  const checkTelegramStatus = async () => {
    try {
      await completeTelegramOnboardingFn({ data: { skipTelegram: false } })
      await router.invalidate()
      navigate({ to: '/equipment' })
    } catch {
      setTimeout(checkTelegramStatus, 3000)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      {step === 'telegram' ? (
        <>
          <OnboardingHeader
            title="Link Your Telegram"
            description="Connect your Telegram account to complete onboarding"
          />
          <TelegramStep
            telegramUrl={telegramUrl}
            isChecking={isCheckingTelegram}
            error={error}
            onLink={handleTelegramLink}
          />
        </>
      ) : (
        <>
          <OnboardingHeader
            title="Complete Your Profile"
            description="Please provide your information to complete onboarding"
          />
          <ProfileStep form={form} error={error} onSubmit={onSubmit} />
        </>
      )}
    </div>
  )
}
