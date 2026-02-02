import { Link } from '@tanstack/react-router';
import { Calendar, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Equipment } from "./types";

interface EquipmentCardProps {
  equipment: Equipment;
}

export function EquipmentCard({ equipment }: EquipmentCardProps) {
  const placeholderImage = "/equipment-placeholder.svg";
  const imageUrl = equipment.imagePath ? `/api/images/${equipment.imagePath}` : placeholderImage;
  
  // Determine availability status (for now, using isActive as a proxy)
  const availabilityStatus = equipment.isActive ? "available" : "unavailable";
  const availabilityVariant = equipment.isActive ? "default" : "secondary";
  
  return (
    <Card className="group flex flex-col transition-shadow hover:shadow-lg">
      <CardHeader className="p-0">
        <div className="relative">
          <img
            src={imageUrl}
            alt={equipment.modelName}
            className="h-48 w-full rounded-t-lg object-cover"
            onError={(e) => {
              // Fallback to placeholder if image fails to load
              e.currentTarget.src = placeholderImage;
            }}
          />
          {equipment.category && (
            <Badge className="absolute top-2 left-2">
              {equipment.category.name}
            </Badge>
          )}
          <Badge 
            variant={availabilityVariant}
            className="absolute top-2 right-2"
          >
            {availabilityStatus}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-6">
        <CardTitle className="mb-2 line-clamp-2 text-lg font-semibold">
          {equipment.modelName}
        </CardTitle>

        {equipment.description && (
          <p className="text-muted-foreground mb-3 text-sm line-clamp-2">
            {equipment.description}
          </p>
        )}

        {equipment.requiredClearanceLevel && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Clearance Level {equipment.requiredClearanceLevel}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-6 pt-0">
        <Button asChild className="w-full">
          <Link to="/equipment/$" params={{ _splat: equipment.id.toString() }}>
            <Calendar className="mr-2 h-4 w-4" />
            Book Now
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}