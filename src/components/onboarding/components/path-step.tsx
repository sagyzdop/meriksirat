import { Flame, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface PathStepProps {
  showFlamekeeperNotice: boolean
  onChooseMember: () => void
  onChooseFlamekeeper: () => void
}

export function PathStep({
  showFlamekeeperNotice,
  onChooseMember,
  onChooseFlamekeeper,
}: PathStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How do you want to join?</CardTitle>
        <CardDescription>
          Choose the option that fits you. You can add the other one later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={onChooseMember} className="w-full">
          <Users className="mr-2 h-4 w-4" />
          Club member
        </Button>
        <Button
          variant="outline"
          onClick={onChooseFlamekeeper}
          className="w-full"
        >
          <Flame className="mr-2 h-4 w-4" />
          Flamekeeper
        </Button>
        {showFlamekeeperNotice && (
          <div className="rounded bg-muted p-3 text-center text-sm text-muted-foreground">
            Flamekeeper signup is coming soon. For now, join as a club member
            with the club code.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
