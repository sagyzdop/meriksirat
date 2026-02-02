import { EquipmentCard } from "./equipment-card";
import { Equipment } from "../../types";

interface EquipmentGridProps {
  equipment: Equipment[];
  viewMode: string;
}

export function EquipmentGrid({ equipment, viewMode }: EquipmentGridProps) {
  if (equipment.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto max-w-md">
          <div className="mb-4 text-6xl">🔧</div>
          <h3 className="text-lg font-semibold mb-2">No Equipment Found</h3>
          <p className="text-muted-foreground text-sm">
            No equipment matches your current search or filter criteria.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`grid gap-4 sm:gap-6 ${
        viewMode === "grid"
          ? "xs:grid-cols-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4"
          : "grid-cols-1"
      }`}>
      {equipment.map((item) => (
        <EquipmentCard key={item.id} equipment={item} />
      ))}
    </div>
  );
}