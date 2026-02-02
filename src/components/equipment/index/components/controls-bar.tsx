import { Search, Grid3X3, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { FilterSection } from "./filter-section";

interface ControlsBarProps {
  searchQuery: string;
  viewMode: string;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: string) => void;
  setCurrentPage: (page: number) => void;
}

export function ControlsBar({
  searchQuery,
  viewMode,
  currentPage,
  totalPages,
  totalItems,
  setSearchQuery,
  setViewMode,
  setCurrentPage
}: ControlsBarProps) {
  return (
    <div className="mb-4 flex flex-col gap-4 sm:mb-6">
      {/* Top row - Filter, equipment count, and view toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Filter Dropdown - Always visible */}
          <FilterSection />

          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            {totalItems === 0 ? "No equipment available" : `${totalItems} total`}
          </div>
        </div>

        {/* View Toggle - Desktop only */}
        <div className="hidden sm:block">
          <ToggleGroup type="single" value={viewMode} onValueChange={setViewMode}>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <Grid3X3 className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Bottom row - Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 sm:flex-initial">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="Search equipment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 sm:w-64"
          />
        </div>

        {/* View Toggle - Mobile */}
        <div className="sm:hidden">
          <ToggleGroup type="single" value={viewMode} onValueChange={setViewMode}>
            <ToggleGroupItem value="grid" aria-label="Grid view" size="sm">
              <Grid3X3 className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" size="sm">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNum)}
                      isActive={currentPage === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}