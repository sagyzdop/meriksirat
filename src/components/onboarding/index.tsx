import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { GalleryVerticalEnd, ExternalLink } from 'lucide-react'
import { updateUserOnboardingFn, completeTelegramOnboardingFn, getTelegramLinkUrlFn } from '@/lib/auth/onboarding'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FieldDescription, FieldGroup } from '@/components/ui/field'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import DatePicker from '@/components/shared/date-picker'
import { useState } from 'react'

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

export function Page({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const navigate = useNavigate()
  const router = useRouter()
  const [step, setStep] = useState<OnboardingStep>('profile')
  const [telegramUrl, setTelegramUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCheckingTelegram, setIsCheckingTelegram] = useState(false)

  const form = useForm<OnboardingForm>({
    resolver: zodResolver(updateOnboardingSchema),
    mode: 'onBlur', // Show validation on blur
    reValidateMode: 'onChange', // Re-validate on change after first validation
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
          birthday: data.birthday.toISOString(),
          instagramUsername: data.instagramUsername,
          nuId: parseInt(data.nuId),
          major: data.major,
          graduationYear: parseInt(data.graduationYear),
        }
      })

      if (result.needsTelegramLink) {
        // Generate telegram link token
        const tokenResult = await getTelegramLinkUrlFn()

        // Auto-skip in development
        if (tokenResult.isDevelopment) {
          await completeTelegramOnboardingFn({ data: { skipTelegram: true } })
          await router.invalidate() // Invalidate to refresh session
          await navigate({ to: '/equipment' })
          return
        }

        setStep('telegram')

        if (tokenResult.alreadyLinked) {
          // User already has telegram linked, complete onboarding
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

      // Start checking if telegram is linked
      setIsCheckingTelegram(true)
      checkTelegramStatus()
    }
  }

  const checkTelegramStatus = async () => {
    try {
      await completeTelegramOnboardingFn({ data: { skipTelegram: false } })
      await router.invalidate()
      navigate({ to: '/equipment' })
    } catch (error) {
      // Not linked yet, check again in 3 seconds
      setTimeout(checkTelegramStatus, 3000)
    }
  }

  if (step === 'telegram') {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <div className="flex flex-col items-center gap-2 text-center">
          <a href="#" className="flex flex-col items-center gap-2 font-medium">
            <div className="flex size-8 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-6" />
            </div>
            <span className="sr-only">MerikSirat</span>
          </a>
          <h1 className="text-xl font-bold">Link Your Telegram</h1>
          <FieldDescription>
            Connect your Telegram account to complete onboarding
          </FieldDescription>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Step 2: Telegram Integration</CardTitle>
            <CardDescription>
              Link your Telegram account to receive notifications and access club features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleTelegramLink}
              className="w-full"
              disabled={!telegramUrl || isCheckingTelegram}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {isCheckingTelegram ? 'Waiting for Telegram...' : 'Open Telegram Bot'}
            </Button>

            {isCheckingTelegram && (
              <div className="text-center text-sm text-muted-foreground space-y-2">
                <p>We'll automatically continue once linked...</p>
              </div>
            )}

            {error && (
              <div className="text-center text-sm text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <a href="#" className="flex flex-col items-center gap-2 font-medium">
          <div className="flex size-8 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-6" />
          </div>
          <span className="sr-only">MerikSirat</span>
        </a>
        <h1 className="text-xl font-bold">Complete Your Profile</h1>
        <FieldDescription>
          Please provide your information to complete onboarding
        </FieldDescription>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your first name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your last name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="birthday"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nuId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NU ID</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Enter your NU ID"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="major"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Major</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your major" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="graduationYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Graduation Year</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Enter your graduation year"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="instagramUsername"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instagram Username (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="@username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FieldGroup>

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Completing...' : 'Complete Onboarding'}
          </Button>

          {error && (
            <div className="text-center text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
        </form>
      </Form>
    </div>
  )
}
