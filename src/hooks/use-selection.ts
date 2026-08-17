import * as React from 'react'
import type { RowSelectionState, OnChangeFn } from '@tanstack/react-table'

interface UseSelectionOptions<T> {
  items: T[]
  getId: (item: T) => number
  initialSelectedIds?: number[]
  storageKey?: string
}

interface UseSelectionResult {
  selectedIds: number[]
  rowSelection: RowSelectionState
  onRowSelectionChange: OnChangeFn<RowSelectionState>
  toggleSelection: (id: number) => void
  clearSelection: () => void
}

export function useSelection<T>({
  items,
  getId,
  initialSelectedIds = [],
  storageKey,
}: UseSelectionOptions<T>): UseSelectionResult {
  const [selectedIds, setSelectedIds] = React.useState<number[]>(() => {
    if (!storageKey || typeof window === 'undefined') {
      return initialSelectedIds
    }
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return initialSelectedIds
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed)
        ? parsed.map(Number).filter(Number.isFinite)
        : initialSelectedIds
    } catch {
      return initialSelectedIds
    }
  })

  const itemIds = React.useMemo(() => items.map(getId), [items, getId])

  const rowSelection = React.useMemo<RowSelectionState>(() => {
    const selection: RowSelectionState = {}
    itemIds.forEach((id) => {
      if (selectedIds.includes(id)) {
        selection[id.toString()] = true
      }
    })
    return selection
  }, [itemIds, selectedIds])

  const onRowSelectionChange = React.useCallback<OnChangeFn<RowSelectionState>>(
    (updaterOrValue) => {
      setSelectedIds((prev) => {
        const nextSelection =
          typeof updaterOrValue === 'function'
            ? updaterOrValue(rowSelection)
            : updaterOrValue

        const selectedOnPage = Object.keys(nextSelection)
          .filter((key) => nextSelection[key])
          .map((key) => Number(key))
          .filter((id) => Number.isFinite(id))

        const remaining = prev.filter((id) => !itemIds.includes(id))
        return Array.from(new Set([...remaining, ...selectedOnPage]))
      })
    },
    [itemIds, rowSelection]
  )

  const toggleSelection = React.useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    )
  }, [])

  const clearSelection = React.useCallback(() => {
    setSelectedIds([])
  }, [])

  React.useEffect(() => {
    if (!storageKey) return
    if (typeof window === 'undefined') return
    window.localStorage.setItem(storageKey, JSON.stringify(selectedIds))
  }, [selectedIds, storageKey])

  return {
    selectedIds,
    rowSelection,
    onRowSelectionChange,
    toggleSelection,
    clearSelection,
  }
}
