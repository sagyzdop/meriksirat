import { useState } from 'react'
import {
  ArrowRight,
  Eye,
  Flame,
  GraduationCap,
  Images,
  Trash2,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Item, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { startDriveConnectFn } from '@/lib/flamekeeper/functions'
import { DEFAULT_PLEDGE_CHOICE, resolvePledge } from '@/lib/flamekeeper/pledge'
import { TERMS_URL, formatGb } from '@/lib/flamekeeper/rules'
import {
  formatGraduationMonth,
  graduationDateError,
} from '@/lib/graduation-date'
import { errorMessage } from '@/lib/utils'
import { GraduationMonthInput } from '@/components/shared/graduation-month-input'
import { PledgePicker } from '@/components/shared/pledge-picker'

const ANSWERS = [
  {
    icon: Eye,
    question: 'What can the app see?',
    answer:
      "Only the files it creates for the club. It can't open, list or read anything else in your Drive.",
  },
  {
    icon: Images,
    question: 'Are the photos public?',
    answer:
      'They are the club’s event albums, and anyone can view them on the site. The rest of your Drive stays private.',
  },
  {
    icon: Trash2,
    question: 'Can I delete them?',
    answer:
      'Since the photos are stored in your account, you can delete them just like any other file in Google Drive. However, we ask you not to do that, as manually deleted photos will be lost. If you want to stop being a flamekeeper, you can disconnect the app and it will remove its files from your Drive.',
  },
  {
    icon: GraduationCap,
    question: 'What happens when I leave or graduate?',
    answer:
      'Within 60 days before graduating, and when you stop being a flamekeeper, the app will start transfering photos stored in your Drive to the club accounts. We ask you to keep your account active and dont delete any files during this period. After the transfer is complete, the app’s access to your Drive will end.',
  },
]

const RESERVE = 'Your pledge will be reserved and used as needed.'

const STEPS = ['FAQ', 'Your pledge', 'Connect']

interface PageProps {
  graduationDate: string | null
  connectError?: string | null
}

export function Page({ graduationDate, connectError }: PageProps) {
  const [step, setStep] = useState(0)
  const [choice, setChoice] = useState(DEFAULT_PLEDGE_CHOICE)
  const [date, setDate] = useState(graduationDate ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const pledge = resolvePledge(choice)
  const dateError = date
    ? graduationDateError(date, { isFlamekeeper: true })
    : 'Choose your graduation month'
  const valid = pledge.ok && !dateError
  const shownError = submitError ?? connectError

  const connect = async () => {
    if (!pledge.ok || dateError) return
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const { url } = await startDriveConnectFn({
        data: { mode: 'signup', pledgeGb: pledge.gb, graduationDate: date },
      })
      window.location.assign(url)
    } catch (error) {
      setSubmitError(errorMessage(error, 'Could not start Drive connection.'))
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 px-4 pt-10 pb-32">
      <div className="space-y-2 text-center">
        <Flame className="mx-auto size-9 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Become a flamekeeper
        </h1>
        <p className="text-muted-foreground">
          Step {step + 1} of 3: {STEPS[step]}
        </p>
      </div>
      <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />

      {shownError && (
        <Alert variant="destructive">
          <AlertDescription>{shownError}</AlertDescription>
        </Alert>
      )}

      {step === 0 && (
        <div className="space-y-4">
          <Accordion
            type="single"
            collapsible
            defaultValue={ANSWERS[0].question}
          >
            {ANSWERS.map((a) => (
              <AccordionItem key={a.question} value={a.question}>
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <a.icon className="size-4 text-primary" />
                    {a.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {a.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <p className="text-sm text-muted-foreground">{RESERVE}</p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-3">
            <Label id="pledge-label">How much can you lend?</Label>
            <PledgePicker value={choice} onChange={setChoice} />
            <p className="text-sm text-muted-foreground">
              You can change it later.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="graduation">When do you graduate?</Label>
            <GraduationMonthInput
              id="graduation"
              value={date}
              onValueChange={setDate}
              aria-invalid={!!date && !!dateError}
            />
            <p
              className={`text-sm ${date && dateError ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {date && dateError
                ? dateError
                : graduationDate && date === graduationDate
                  ? 'Filled in from your profile.'
                  : 'Month and year. It must be in the future.'}
            </p>
            <p className="text-sm text-muted-foreground italic">
              Foundation year students: set it to the end of the current
              academic year, since your account is suspended and later deleted
              if you do not move on to the bachelor's program.
            </p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <Item variant="outline">
            <ItemMedia variant="icon">
              <Flame />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                {pledge.ok ? formatGb(pledge.bytes) : '?'} until{' '}
                {formatGraduationMonth(date) || '?'}
              </ItemTitle>
            </ItemContent>
          </Item>
          <div className="space-y-2">
            <Button
              className="w-full"
              size="lg"
              disabled={!valid || isSubmitting}
              onClick={connect}
            >
              {isSubmitting
                ? 'Redirecting to Google...'
                : 'Connect Google Drive'}
              {!isSubmitting && <ArrowRight />}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              By connecting you agree to the{' '}
              <a
                href={TERMS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                terms
              </a>
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        {step > 0 ? (
          <Button
            variant="ghost"
            disabled={isSubmitting}
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < 2 && (
          <Button
            disabled={step === 1 && !valid}
            onClick={() => setStep(step + 1)}
          >
            Next
          </Button>
        )}
      </div>
    </div>
  )
}
