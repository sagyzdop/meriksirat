import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Category } from "./types";
import { getCategoryIcon } from "./category-icons";

interface EquipmentCategoryComboboxProps {
  categories: Category[]
  equipmentCounts: Record<number, number>
  totalCount: number
  activeCategoryId?: number
  isSearching: boolean
  onSelect: (categoryId?: number) => void
}

export function EquipmentCategoryCombobox({
  categories,
  equipmentCounts,
  totalCount,
  activeCategoryId,
  isSearching,
  onSelect,
}: EquipmentCategoryComboboxProps) {
  const sortedCategories = [...categories].sort(
    (a, b) =>
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
      a.name.localeCompare(b.name)
  )

  const optionLookup = new Map<string, { label: string; count: number }>([
    ["all", { label: "All Equipment", count: totalCount }],
    ...sortedCategories.map((category) => [
      String(category.id),
      { label: category.name, count: equipmentCounts[category.id] ?? 0 },
    ] as [string, { label: string; count: number }]),
  ])

  const items = ["all", ...sortedCategories.map((category) => String(category.id))]

  const selectedCategory =
    !isSearching && activeCategoryId !== undefined
      ? (categories.find((c) => c.id === activeCategoryId) ?? null)
      : null

  const selectedLabel = selectedCategory?.name ?? "All Equipment"

  const TriggerIcon = selectedCategory ? getCategoryIcon(selectedCategory.name) : null

  const value = isSearching || activeCategoryId === undefined
    ? "all"
    : String(activeCategoryId)

  return (
    <Combobox
      items={items}
      value={value}
      filter={() => true}
      onValueChange={(next) => {
        if (next === null || next === "all") onSelect(undefined)
        else onSelect(Number(next))
      }}
    >
      <ComboboxTrigger
        render={
          <Button variant="outline" size="sm" className="w-full">
            {TriggerIcon && <TriggerIcon />}
            <span className="truncate">{selectedLabel}</span>
          </Button>
        }
      />
      <ComboboxContent align="start" className="min-w-[var(--anchor-width)]">
        <ComboboxEmpty>No categories found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => {
            const option = optionLookup.get(item)
            if (!option) return null
            const Icon = item === "all" ? null : getCategoryIcon(option.label)
            return (
              <ComboboxItem key={item} value={item}>
                {Icon && <Icon className="size-4" />}
                <span className="truncate">{option.label}</span>
                <span className="ml-auto pl-4 text-xs text-muted-foreground">
                  {option.count}
                </span>
              </ComboboxItem>
            )
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
