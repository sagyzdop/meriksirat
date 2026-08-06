import { EquipmentCard } from "./equipment-card";
import { EquipmentSkeleton } from "./equipment-skeleton";
import { Equipment } from "./types";
import { ContentGrid } from "@/components/layout/content-grid";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { PackageOpen, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface EquipmentGridProps {
  equipment: Equipment[];
  hasActiveFilters?: boolean;
  isLoading?: boolean;
  className?: string;
  selectedEquipmentIds?: number[];
  onToggleSelect?: (equipmentId: number) => void;
}

export function EquipmentGrid({
  equipment,
  hasActiveFilters = false,
  isLoading = false,
  className,
  selectedEquipmentIds,
  onToggleSelect,
}: EquipmentGridProps) {
  if (isLoading) {
    return (
      <ContentGrid
        columns={{
          mobile: 1,
          tablet: 2,
          desktop: 3,
        }}
        gap={6}
        className={cn(className)}
      >
        {Array.from({ length: 12 }).map((_, index) => (
          <EquipmentSkeleton key={index} />
        ))}
      </ContentGrid>
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

  return (
    <ContentGrid
      columns={{
        mobile: 1,
        tablet: 2,
        desktop: 3,
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
