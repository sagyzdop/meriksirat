import type { MovePreviewItem } from '@/lib/albums/storage-plan'

export function SkippedItems({
  items,
  titles,
}: {
  items: { albumId: string; reason: string }[]
  titles: Map<string, string>
}) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">Skipped ({items.length})</p>
      <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
        {items.map((item) => (
          <li key={item.albumId} className="flex flex-col sm:flex-row sm:gap-2">
            <span className="truncate font-medium">
              {titles.get(item.albumId) ?? item.albumId}
            </span>
            <span className="text-muted-foreground">{item.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function previewSkips(items: MovePreviewItem[]) {
  return items
    .filter((item) => item.skipReason)
    .map((item) => ({ albumId: item.albumId, reason: item.skipReason! }))
}

export function movableIds(items: MovePreviewItem[]) {
  return items.filter((item) => !item.skipReason).map((item) => item.albumId)
}
