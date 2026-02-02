import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter } from "lucide-react";
import { useEquipmentStore } from "./store";

export function FilterSection() {
  const {
    categories,
    selectedCategoryId,
    setSelectedCategoryId
  } = useEquipmentStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <Filter className="mr-2 h-4 w-4" />
          Category
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={selectedCategoryId === ""}
            onCheckedChange={(checked) => {
              if (checked) setSelectedCategoryId("");
            }}
          >
            All Categories
          </DropdownMenuCheckboxItem>
          {categories.map((category) => (
            <DropdownMenuCheckboxItem
              key={category.id}
              checked={selectedCategoryId === category.id}
              onCheckedChange={(checked) => {
                if (checked) setSelectedCategoryId(category.id);
              }}
            >
              {category.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}