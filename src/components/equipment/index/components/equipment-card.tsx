import { Link } from '@tanstack/react-router';
import { Calendar, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Equipment } from "./types";

interface EquipmentCardProps {
  equipment: Equipment;
}

export function EquipmentCard({ equipment }: EquipmentCardProps) {
  const placeholderImage = "/equipment-placeholder.svg";
  const imageUrl = equipment.imagePath ? `/api/images/${equipment.imagePath}` : placeholderImage;
  
  return (
    <Card className="group transition-shadow hover:shadow-lg">
      <CardContent className="p-3 sm:p-4">
        <div className="relative mb-3 sm:mb-4">
          <img
            src={imageUrl}
            alt={equipment.modelName}
            className="h-40 w-full rounded-md object-cover sm:h-48"
            onError={(e) => {
              // Fallback to placeholder if image fails to load
              e.currentTarget.src = placeholderImage;
            }}
          />
          {equipment.category && (
            <Badge className="absolute top-2 left-2 text-xs">
              {equipment.category.name}
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="line-clamp-2 text-sm leading-tight font-medium">
            {equipment.modelName}
          </h3>

          {equipment.description && (
            <p className="text-muted-foreground text-xs line-clamp-2">
              {equipment.description}
            </p>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {equipment.requiredClearanceLevel && (
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                <span>Level {equipment.requiredClearanceLevel}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button asChild className="flex-1" size="sm">
              <Link to="/equipment/$" params={{ _splat: equipment.id.toString() }}>
                <Calendar className="mr-1 h-4 w-4 sm:mr-2" />
                <span className="xs:inline hidden">Book Equipment</span>
                <span className="xs:hidden">Book</span>
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}