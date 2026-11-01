import { Flame } from 'lucide-react'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { PublicAlbumsLayout } from '@/components/albums/public-layout'
import { UserAvatar } from '@/components/shared/user-avatar'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatGb } from '@/lib/flamekeeper/rules'
import type { LeaderboardEntry } from '@/lib/pool/leaderboard'

interface PageProps {
  entries: LeaderboardEntry[]
}

export function Page({ entries }: PageProps) {
  return (
    <PublicAlbumsLayout>
      <PageContainer>
        <PageHeader
          title="Flamekeepers"
          description="Students who lend their Drive storage to keep NU Image albums alive. Thank you."
        />
        {entries.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Flame />
              </EmptyMedia>
              <EmptyTitle>No flamekeepers yet</EmptyTitle>
              <EmptyDescription>
                Flamekeepers will appear here once they start holding photos.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Flamekeeper</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead className="text-right">Pledged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, i) => (
                <TableRow key={i}>
                  <TableCell className="tabular-nums">{entry.rank}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        image={entry.image}
                        name={entry.name}
                        className="size-8"
                      />
                      <span
                        className={entry.anonymous ? 'italic' : 'font-medium'}
                      >
                        {entry.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatGb(entry.usedBytes)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {formatGb(entry.pledgedBytes)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </PageContainer>
    </PublicAlbumsLayout>
  )
}
