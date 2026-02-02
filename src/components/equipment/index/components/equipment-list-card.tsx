import { Link } from '@tanstack/react-router';
import { Calendar, Shield } from "lucide-react";
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
  
  // Determine availability status (for now, using isActive as a proxy)
  const availabilityStatus = equipment.isActive ? "available" : "unavailable";
  const availabilityVariant = equipment.isActive ? "default" : "secondary";
  
  return (
    <Card className="group transition-shadow hover:shadow-lg">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Image Section */}
          <div className="relative sm:w-64 flex-shrink-0">
            <img
              src={imageUrl}
              alt={equipment.modelName}
              className="h-48 w-full object-cover sm:h-full sm:rounded-l-lg"
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

          {/* Content Section */}
          <div className="flex flex-1 flex-col justify-between p-6">
            <div>
              <h3 className="mb-2 text-lg font-semibold">
                {equipment.modelName}
              </h3>

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
            </div>

            {/* Action Button */}
            <div className="mt-4">
              <Button asChild className="w-full sm:w-auto">
                <Link to="/equipment/$" params={{ _splat: equipment.id.toString() }}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Book Now
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
