import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Copy, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { rotateClubCodeFn } from '@/lib/admin/functions/club-code'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'

interface ClubCodeCardProps {
  clubCode: string
}

export function ClubCodeCard({ clubCode }: ClubCodeCardProps) {
  const queryClient = useQueryClient()
  const [isRotating, setIsRotating] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(clubCode)
      toast.success('Club code copied')
    } catch {
      toast.error('Could not copy the club code')
    }
  }

  const handleRotate = async () => {
    setIsRotating(true)
    try {
      const next = await rotateClubCodeFn()
      queryClient.setQueryData(adminDashboardQueries.clubCode().queryKey, next)
      toast.success('Club code rotated')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to rotate club code'
      )
    } finally {
      setIsRotating(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Club code</CardTitle>
        <CardDescription>
          New members enter this code at signup. Rotating it does not affect
          existing members.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <code className="rounded-md border bg-muted px-3 py-1.5 font-mono text-lg tracking-widest">
          {clubCode}
        </code>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy />
          Copy
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRotate}
          disabled={isRotating}
        >
          <RefreshCw />
          {isRotating ? 'Rotating...' : 'Rotate'}
        </Button>
      </CardContent>
    </Card>
  )
}
