import { Link } from '@tanstack/react-router';
import { Calendar, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Card, 
  CardAction,
  CardDescription,
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Equipment } from "./types";

interface EquipmentCardProps {
  equipment: Equipment;
  isSelected?: boolean;
  onToggleSelect?: (equipmentId: number) => void;
}

export function EquipmentCard({ equipment, isSelected = false, onToggleSelect }: EquipmentCardProps) {
  const placeholderImage = "/equipment-placeholder.svg";
  const imageUrl = equipment.imagePath ? `/api/images/${equipment.imagePath}` : placeholderImage;
  
  const isAvailable = equipment.isActive !== false;
  
  return (
    <Card className={`group relative mx-auto w-full overflow-hidden pt-0 transition-all hover:shadow-lg${isSelected ? " ring-2 ring-primary/40" : ""}`}>
      {onToggleSelect && (
        <div
          className="absolute left-3 top-3 z-10 rounded-md bg-background/90 p-1 shadow"
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(equipment.id)}
            aria-label="Select equipment"
          />
        </div>
      )}
      {/* Image Section */}
      <img
        src={imageUrl}
        alt={equipment.modelName}
        className="aspect-video w-full object-cover transition-transform group-hover:scale-105"
        onError={(e) => {
          e.currentTarget.src = placeholderImage;
        }}
      />

      <CardHeader>
        {equipment.category && (
          <CardAction>
            <Badge variant="secondary">
              {equipment.category.name}
            </Badge>
          </CardAction>
        )}
        <CardTitle className="line-clamp-1">
          {equipment.modelName}
        </CardTitle>
        {equipment.description && (
          <CardDescription className="line-clamp-2">
            {equipment.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardFooter className="flex gap-2">
        <Button asChild className="flex-1" disabled={!isAvailable}>
          <Link to="/bookings/new" search={{ equipmentId: equipment.id }}>
            <Calendar className="mr-2 h-4 w-4" />
            Book
          </Link>
        </Button>
        <Button asChild variant="outline" className="flex-1" disabled={!isAvailable}>
          <Link to="/equipment/$" params={{ _splat: equipment.id.toString() }}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
