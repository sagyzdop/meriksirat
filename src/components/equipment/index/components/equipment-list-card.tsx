import { Link } from '@tanstack/react-router';
import { Calendar, Shield, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Equipment } from "./types";

interface EquipmentListCardProps {
  equipment: Equipment;
}

export function EquipmentListCard({ equipment }: EquipmentListCardProps) {
  const placeholderImage = "/equipment-placeholder.svg";
  const imageUrl = equipment.imagePath ? `/api/images/${equipment.imagePath}` : placeholderImage;
  
  // Determine availability status
  const isAvailable = equipment.isActive !== false;
  const availabilityVariant = isAvailable ? "default" : "secondary";
  
  return (
    <Card className="group transition-all hover:shadow-md">
      <CardContent className="flex gap-4 p-4">
        {/* Image */}
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
          <img
            src={imageUrl}
            alt={equipment.modelName}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.src = placeholderImage;
            }}
          />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col justify-between gap-2">
          <div>
            <div className="mb-1 flex items-start justify-between gap-2">
              <h3 className="font-semibold line-clamp-1 text-lg">{equipment.modelName}</h3>
              <Badge variant={availabilityVariant} className="shrink-0">
                {isAvailable ? "Available" : "Unavailable"}
              </Badge>
            </div>
            
            {equipment.description && (
              <p className="text-muted-foreground mb-2 text-sm line-clamp-2">
                {equipment.description}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {equipment.category && (
                <Badge variant="outline" className="text-xs">
                  <Tag className="mr-1 h-3 w-3" />
                  {equipment.category.name}
                </Badge>
              )}
              {equipment.requiredClearanceLevel && (
                <Badge variant="outline" className="text-xs">
                  <Shield className="mr-1 h-3 w-3" />
                  Level {equipment.requiredClearanceLevel}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="flex shrink-0 items-center">
          <Button asChild size="sm" disabled={!isAvailable}>
            <Link to="/equipment/$" params={{ _splat: equipment.id.toString() }}>
              <Calendar className="mr-2 h-4 w-4" />
              {isAvailable ? "Book" : "View"}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
