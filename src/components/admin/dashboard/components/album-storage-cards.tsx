import { FolderOpen, HardDrive, Images } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { AlbumStorageStats } from '@/lib/admin/dashboard-types'
import { cn } from '@/lib/utils'

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / 1024 ** exponent
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`
}

interface AlbumStorageCardsProps {
  stats?: AlbumStorageStats
  isLoading?: boolean
}

const cards = [
  {
    key: 'albumCount' as const,
    label: 'Albums',
    icon: FolderOpen,
    accent: 'bg-purple-100 dark:bg-purple-900/20',
    iconClass: 'text-purple-600 dark:text-purple-400',
    format: (value: number) => value.toLocaleString(),
  },
  {
    key: 'photoCount' as const,
    label: 'Photos',
    icon: Images,
    accent: 'bg-sky-100 dark:bg-sky-900/20',
    iconClass: 'text-sky-600 dark:text-sky-400',
    format: (value: number) => value.toLocaleString(),
  },
  {
    key: 'totalBytes' as const,
    label: 'Storage Used',
    icon: HardDrive,
    accent: 'bg-emerald-100 dark:bg-emerald-900/20',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    format: formatBytes,
  },
]

export function AlbumStorageCards({
  stats,
  isLoading = false,
}: AlbumStorageCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon
        const value = stats?.[card.key]
        return (
          <Card key={card.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading && value === undefined ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      card.accent
                    )}
                  >
                    <Icon className={cn('h-4 w-4', card.iconClass)} />
                  </div>
                  <span className="text-2xl font-bold tabular-nums">
                    {card.format(value ?? 0)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
