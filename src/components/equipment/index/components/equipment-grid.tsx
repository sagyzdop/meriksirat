import { EquipmentCard } from "./equipment-card";
import { EquipmentListCard } from "./equipment-list-card";
import { Equipment } from "./types";
import { ContentGrid } from "@/components/layout/content-grid";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { PackageOpen, Search } from "lucide-react";

interface EquipmentGridProps {
  equipment: Equipment[];
  viewMode: string;
  hasActiveFilters?: boolean;
}

export function EquipmentGrid({ equipment, viewMode, hasActiveFilters = false }: EquipmentGridProps) {
  if (equipment.length === 0) {
    // Show different empty state based on whether filters are active
    if (hasActiveFilters) {
      return (
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
      );
    }

    // No equipment at all
    return (
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
      >
        {equipment.map((item) => (
          <EquipmentCard key={item.id} equipment={item} />
        ))}
      </ContentGrid>
    );
  }

  // List view - single column with horizontal layout
  return (
    <div className="grid grid-cols-1 gap-4">
      {equipment.map((item) => (
        <EquipmentListCard key={item.id} equipment={item} />
      ))}
    </div>
  );
}