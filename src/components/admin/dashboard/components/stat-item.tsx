import type { LucideIcon } from 'lucide-react'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'

export function StatItem({
  icon: Icon,
  label,
  value,
  isLoading,
}: {
  icon: LucideIcon
  label: string
  value?: string
  isLoading: boolean
}) {
  return (
    <Item variant="outline" size="sm">
      <ItemMedia variant="icon">
        <Icon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{label}</ItemTitle>
      </ItemContent>
      {isLoading && value === undefined ? (
        <Skeleton className="h-4 w-12" />
      ) : (
        <ItemDescription className="font-semibold tabular-nums text-foreground">
          {value}
        </ItemDescription>
      )}
    </Item>
  )
}
