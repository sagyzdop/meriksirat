import { useEffect } from "react";
import { useEquipmentStore } from "./store";
import { useDebounce } from "@/hooks/use-debounce";
import { ControlsBar } from "./components/controls-bar";
import { EquipmentGrid } from "./components/equipment-grid";
import { Spinner } from "@/components/ui/spinner";

export function Page() {
  const {
    filteredEquipment,
    searchQuery,
    viewMode,
    isLoading,
    currentPage,
    totalPages,
    totalItems,
    setSearchQuery,
    setViewMode,
    setCurrentPage,
    initialize,
    loadEquipment
  } = useEquipmentStore();
  
  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Initialize data on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Trigger search when debounced query changes
  useEffect(() => {
    loadEquipment();
  }, [debouncedSearchQuery, loadEquipment]);

  return (
    <div className="px-4 py-4 sm:py-6">
      <div className="mx-auto max-w-7xl">
        {/* Controls Bar */}
        <ControlsBar
          searchQuery={searchQuery}
          viewMode={viewMode}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          setSearchQuery={setSearchQuery}
          setViewMode={setViewMode}
          setCurrentPage={setCurrentPage}
        />

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        )}

        {/* Equipment Grid */}
        {!isLoading && (
          <EquipmentGrid equipment={filteredEquipment} viewMode={viewMode} />
        )}
      </div>
    </div>
  );
}
