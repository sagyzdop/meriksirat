import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { expireAlbumNowFn } from '@/lib/admin/functions/free-space'
import type { FreeSpaceSuggestion } from '@/lib/admin/functions/free-space'
import { formatBytes } from './album-storage-cards'

interface FreeSpacePanelProps {
  suggestions: FreeSpaceSuggestion[]
  isLoading: boolean
}

export function FreeSpacePanel({
  suggestions,
  isLoading,
}: FreeSpacePanelProps) {
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<FreeSpaceSuggestion | null>(null)
  const [isExpiring, setIsExpiring] = useState(false)

  const handleExpire = async () => {
    if (!target) return
    setIsExpiring(true)
    try {
      const result = await expireAlbumNowFn({ data: { albumId: target.id } })
      toast.success(
        `"${target.title}" will be deleted in 7 days. ${result.notified} ${result.notified === 1 ? 'person' : 'people'} notified.`
      )
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['albums'] })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to expire album'
      )
    } finally {
      setIsExpiring(false)
      setTarget(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Free up space</CardTitle>
        <CardDescription>
          Unpinned albums nobody favorited come first, then favorited ones; each
          group by soonest expiry, then largest size. Expiring an album now
          gives its owner and everyone who favorited a photo in it 7 days'
          notice. Nothing is deleted until then.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No albums to suggest.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Album</TableHead>
                <TableHead className="whitespace-nowrap">Expires</TableHead>
                <TableHead className="whitespace-nowrap">Size</TableHead>
                <TableHead className="whitespace-nowrap">Favorites</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.title}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.expiresAt
                      ? new Date(s.expiresAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Never'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatBytes(s.photoBytes)}
                  </TableCell>
                  <TableCell>{s.favoriteCount}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTarget(s)}
                    >
                      Expire now
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <AlertDialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open && !isExpiring) setTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Expire "{target?.title}" now?</AlertDialogTitle>
            <AlertDialogDescription>
              The album will be deleted in 7 days. Its owner and everyone who
              favorited one of its photos are notified now. There is no backup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExpiring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isExpiring}
              onClick={(e) => {
                e.preventDefault()
                void handleExpire()
              }}
            >
              Expire and notify
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
