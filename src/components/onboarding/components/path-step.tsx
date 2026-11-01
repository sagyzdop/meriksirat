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
  onChooseMember: () => void
  onChooseFlamekeeper: () => void
}

export function PathStep({
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
      </CardContent>
    </Card>
  )
}
