import {
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Category } from './types'
import { getCategoryIcon } from './category-icons'

interface EquipmentCategoryNavProps {
  categories: Category[]
  equipmentCounts: Record<number, number>
  totalCount: number
  activeCategoryId?: number
  isSearching: boolean
  onSelect: (categoryId?: number) => void
}

interface CategoryNavItemProps {
  category: Category
  count: number
  isActive: boolean
  onSelect: (categoryId: number) => void
}

function CategoryNavItem({
  category,
  count,
  isActive,
  onSelect,
}: CategoryNavItemProps) {
  const Icon = getCategoryIcon(category.name)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <button type="button" onClick={() => onSelect(category.id)}>
          <Icon />
          <span>{category.name}</span>
          <SidebarMenuBadge>{count}</SidebarMenuBadge>
        </button>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function EquipmentCategoryNav({
  categories,
  equipmentCounts,
  totalCount,
  activeCategoryId,
  isSearching,
  onSelect,
}: EquipmentCategoryNavProps) {
  const sortedCategories = [...categories].sort(
    (a, b) =>
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
  )

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={!activeCategoryId || isSearching}>
          <button type="button" onClick={() => onSelect(undefined)}>
            <span>All Equipment</span>
            <SidebarMenuBadge>{totalCount}</SidebarMenuBadge>
          </button>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {sortedCategories.map((category) => (
        <CategoryNavItem
          key={category.id}
          category={category}
          count={equipmentCounts[category.id] ?? 0}
          isActive={activeCategoryId === category.id}
          onSelect={onSelect}
        />
      ))}
    </SidebarMenu>
  )
}
