import { EquipmentCard } from "./equipment-card";
import { EquipmentListCard } from "./equipment-list-card";
import { EquipmentSkeleton } from "./equipment-skeleton";
import { Equipment } from "./types";
import { ContentGrid } from "@/components/layout/content-grid";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { PackageOpen, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface EquipmentGridProps {
  equipment: Equipment[];
  viewMode: string;
  hasActiveFilters?: boolean;
  isLoading?: boolean;
  className?: string;
  selectedEquipmentIds?: number[];
  onToggleSelect?: (equipmentId: number) => void;
}

export function EquipmentGrid({
  equipment,
  viewMode,
  hasActiveFilters = false,
  isLoading = false,
  className,
  selectedEquipmentIds,
  onToggleSelect,
}: EquipmentGridProps) {
  if (isLoading) {
    if (viewMode === "grid") {
      return (
        <ContentGrid
          columns={{
            mobile: 1,
            tablet: 2,
            desktop: 4,
          }}
          gap={6}
          className={cn(className)}
        >
          {Array.from({ length: 12 }).map((_, index) => (
            <EquipmentSkeleton key={index} viewMode="grid" />
          ))}
        </ContentGrid>
      );
    }

    return (
      <div className={cn("grid grid-cols-1 gap-4", className)}>
        {Array.from({ length: 8 }).map((_, index) => (
          <EquipmentSkeleton key={index} viewMode="list" />
        ))}
      </div>
    );
  }

  if (equipment.length === 0) {
    // Show different empty state based on whether filters are active
    if (hasActiveFilters) {
      return (
        <div className={cn(className)}>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search />
              </EmptyMedia>
              <EmptyTitle>No results found</EmptyTitle>
              <EmptyDescription>
                No equipment matches your current search or filter criteria. Try adjusting your filters or search terms.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      );
    }

    // No equipment at all
    return (
      <div className={cn(className)}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageOpen />
            </EmptyMedia>
            <EmptyTitle>No equipment available</EmptyTitle>
            <EmptyDescription>
              There is no equipment available at this time. Please check back later.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  // Use ContentGrid for grid view, single column for list view
  if (viewMode === "grid") {
    return (
      <ContentGrid
        columns={{
          mobile: 1,
          tablet: 2,
          desktop: 4,
        }}
        gap={6}
        className={cn(className)}
      >
        {equipment.map((item) => (
          <EquipmentCard
            key={item.id}
            equipment={item}
            isSelected={selectedEquipmentIds?.includes(item.id) || false}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </ContentGrid>
    );
  }

  // List view - single column with horizontal layout
  return (
    <div className={cn("grid grid-cols-1 gap-4", className)}>
      {equipment.map((item) => (
        <EquipmentListCard
          key={item.id}
          equipment={item}
          isSelected={selectedEquipmentIds?.includes(item.id) || false}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}