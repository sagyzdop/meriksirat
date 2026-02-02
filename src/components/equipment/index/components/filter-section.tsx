import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Filter, X } from "lucide-react";
import { useEquipmentStore } from "./store";
import { useIsMobile } from "@/hooks/use-mobile";
import { Label } from "@/components/ui/label";

export function FilterSection() {
  const {
    categories,
    selectedCategoryId,
    selectedAvailability,
    setSelectedCategoryId,
    setSelectedAvailability,
    clearFilters,
  } = useEquipmentStore();

  const isMobile = useIsMobile();

  // Count active filters
  const activeFilterCount = 
    (selectedCategoryId ? 1 : 0) + 
    (selectedAvailability !== 'all' ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  // Filter content component (reused in both desktop and mobile)
  const FilterContent = () => (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="space-y-4">
        <Label className="text-sm font-semibold">Category</Label>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="category-all"
              checked={selectedCategoryId === ""}
              onCheckedChange={(checked) => {
                if (checked) setSelectedCategoryId("");
              }}
            />
            <label
              htmlFor="category-all"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              All Categories
            </label>
          </div>
          {categories.map((category) => (
            <div key={category.id} className="flex items-center space-x-2">
              <Checkbox
                id={`category-${category.id}`}
                checked={selectedCategoryId === category.id.toString()}
                onCheckedChange={(checked) => {
                  if (checked) setSelectedCategoryId(category.id.toString());
                }}
              />
              <label
                htmlFor={`category-${category.id}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {category.name}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Availability Filter */}
      <div className="space-y-4">
        <Label className="text-sm font-semibold">Availability</Label>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="availability-all"
              checked={selectedAvailability === 'all'}
              onCheckedChange={(checked) => {
                if (checked) setSelectedAvailability('all');
              }}
            />
            <label
              htmlFor="availability-all"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              All Equipment
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="availability-available"
              checked={selectedAvailability === 'available'}
              onCheckedChange={(checked) => {
                if (checked) setSelectedAvailability('available');
              }}
            />
            <label
              htmlFor="availability-available"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Available
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="availability-unavailable"
              checked={selectedAvailability === 'unavailable'}
              onCheckedChange={(checked) => {
                if (checked) setSelectedAvailability('unavailable');
              }}
            />
            <label
              htmlFor="availability-unavailable"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Unavailable
            </label>
          </div>
        </div>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={clearFilters}
          className="w-full"
        >
          <X className="mr-2 h-4 w-4" />
          Clear Filters
        </Button>
      )}
    </div>
  );

  // Mobile: Use Sheet (collapsible panel)
  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="relative">
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 rounded-full px-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              Filter equipment by category and availability
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <FilterContent />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Use inline filter panel
  return (
    <div className="flex items-center gap-2">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="relative">
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 rounded-full px-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              Filter equipment by category and availability
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <FilterContent />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}