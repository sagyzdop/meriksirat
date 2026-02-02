import { useEffect } from "react";
import { useEquipmentStore } from "./components/store";
import { useDebounce } from "@/hooks/use-debounce";
import { ControlsBar } from "./components/controls-bar";
import { EquipmentGrid } from "./components/equipment-grid";
import { EquipmentSkeleton } from "./components/equipment-skeleton";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ContentGrid } from "@/components/layout/content-grid";
import { Search, Grid3X3, List, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FilterSection } from "./components/filter-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Page() {
  const {
    filteredEquipment,
    searchQuery,
    viewMode,
    isLoading,
    currentPage,
    totalPages,
    totalItems,
    categories,
    selectedCategoryId,
    selectedAvailability,
    setSearchQuery,
    setViewMode,
    setCurrentPage,
    setSelectedCategoryId,
    setSelectedAvailability,
    clearFilters,
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

  // Get selected category name
  const selectedCategory = categories.find(
    (cat) => cat.id.toString() === selectedCategoryId
  );

  // Check if any filters are active
  const hasActiveFilters = 
    selectedCategoryId !== "" || 
    selectedAvailability !== 'all' ||
    searchQuery !== "";

  return (
    <PageContainer>
      <PageHeader
        title="Equipment"
        description="Browse and book available equipment"
        actions={
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <ToggleGroup type="single" value={viewMode} onValueChange={setViewMode}>
              <ToggleGroupItem value="grid" aria-label="Grid view">
                <Grid3X3 className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List view">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        }
      />

      {/* Search and Filter Bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-4">
          {/* Search Input */}
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              placeholder="Search equipment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Section */}
          <FilterSection />
        </div>

        {/* Equipment Count */}
        <div className="text-muted-foreground text-sm">
          {totalItems === 0 ? "No equipment available" : `${totalItems} total`}
        </div>
      </div>

      {/* Active Filter Indicators */}
      {hasActiveFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          
          {selectedCategory && (
            <Badge variant="secondary" className="gap-1">
              Category: {selectedCategory.name}
              <button
                onClick={() => setSelectedCategoryId("")}
                className="ml-1 rounded-full hover:bg-secondary-foreground/20"
                aria-label="Remove category filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {selectedAvailability !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {selectedAvailability === 'available' ? 'Available' : 'Unavailable'}
              <button
                onClick={() => setSelectedAvailability('all')}
                className="ml-1 rounded-full hover:bg-secondary-foreground/20"
                aria-label="Remove availability filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: "{searchQuery}"
              <button
                onClick={() => setSearchQuery("")}
                className="ml-1 rounded-full hover:bg-secondary-foreground/20"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-6 px-2 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <>
          {viewMode === "grid" ? (
            <ContentGrid
              columns={{
                mobile: 1,
                tablet: 2,
                desktop: 4,
              }}
              gap={6}
            >
              {Array.from({ length: 8 }).map((_, index) => (
                <EquipmentSkeleton key={index} viewMode={viewMode} />
              ))}
            </ContentGrid>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <EquipmentSkeleton key={index} viewMode={viewMode} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Equipment Grid */}
      {!isLoading && (
        <EquipmentGrid 
          equipment={filteredEquipment} 
          viewMode={viewMode}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
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
      )}
    </PageContainer>
  );
}
