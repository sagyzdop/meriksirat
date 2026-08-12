import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface TelegramStepProps {
  telegramUrl: string | null
  isChecking: boolean
  error: string | null
  onLink: () => void
}

export function TelegramStep({
  telegramUrl,
  isChecking,
  error,
  onLink,
}: TelegramStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Telegram Integration</CardTitle>
        <CardDescription>
          Link your Telegram account to receive notifications and access club
          features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={onLink}
          className="w-full"
          disabled={!telegramUrl || isChecking}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          {isChecking ? 'Waiting for Telegram...' : 'Open Telegram Bot'}
        </Button>

        {isChecking && (
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
  )
}
