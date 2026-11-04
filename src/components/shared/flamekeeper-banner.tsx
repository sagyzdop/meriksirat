import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Flame } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { bufferQueries } from '@/lib/buffer/queries'
import { isNuEmail } from '@/lib/flamekeeper/rules'

export function FlamekeeperBanner({ email }: { email: string }) {
  const { data } = useQuery({
    ...bufferQueries.banner(),
    enabled: isNuEmail(email),
  })
  if (!data) return null

  return (
    <div className="px-4 pt-4 lg:px-6">
      <Alert>
        <Flame />
        <AlertTitle>The club is asking for flamekeepers</AlertTitle>
        <AlertDescription>
          <span>
            Space for new photos is running short. Lend a little of your NU
            Drive to keep the albums safe.{' '}
            <Link to="/profile" className="underline underline-offset-4">
              Open your profile
            </Link>
          </span>
        </AlertDescription>
      </Alert>
    </div>
  )
}
