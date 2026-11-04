import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FlamekeeperSignupForm } from '@/components/shared/flamekeeper-signup-form'

interface FlamekeeperStepProps {
  graduationDate?: string | null
  error: string | null
  onBeforeRedirect: () => void
}

export function FlamekeeperStep({
  graduationDate,
  error,
  onBeforeRedirect,
}: FlamekeeperStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lend some Drive storage</CardTitle>
        <CardDescription>
          NU Image keeps its photos in members&apos; NU Google Drives. Pledge at
          least 1 GB of yours, then connect Drive to finish signing up.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FlamekeeperSignupForm
          initialGraduationDate={graduationDate}
          error={error}
          onBeforeRedirect={onBeforeRedirect}
        />
      </CardContent>
    </Card>
  )
}
