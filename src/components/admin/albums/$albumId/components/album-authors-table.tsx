import { Link } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  RoleBadge,
  StatusBadge,
} from '@/components/admin/users/components/user-badges'
import type { AlbumAuthorRow } from '@/lib/albums/types'

export function AlbumAuthorsTable({ authors }: { authors: AlbumAuthorRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Name</TableHead>
            <TableHead className="whitespace-nowrap">Role</TableHead>
            <TableHead className="whitespace-nowrap">Status</TableHead>
            <TableHead className="whitespace-nowrap">Clearance</TableHead>
            <TableHead className="whitespace-nowrap">Telegram</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {authors.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                No authors found.
              </TableCell>
            </TableRow>
          ) : (
            authors.map((author) => (
              <TableRow key={author.userId}>
                <TableCell className="whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2 font-medium">
                      {author.name}
                      <Badge variant="secondary">
                        {author.authorRole === 'owner' ? 'Owner' : 'Co-author'}
                      </Badge>
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {author.email}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <RoleBadge role={author.role} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={author.status} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {author.clearanceLevel
                    ? `Level ${author.clearanceLevel}`
                    : '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {author.telegramUsername
                    ? `@${author.telegramUsername}`
                    : author.telegramLinked
                      ? 'Linked'
                      : '—'}
                </TableCell>
                <TableCell>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="size-8"
                  >
                    <Link
                      to="/admin/users/$userId"
                      params={{ userId: author.userId }}
                      aria-label={`Open ${author.name}`}
                    >
                      <ExternalLink />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
