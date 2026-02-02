import { Shield, Tag, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { EquipmentWithCategory } from "@/lib/equipment";

interface EquipmentDetailProps {
  equipment: EquipmentWithCategory;
}

export function EquipmentDetail({ equipment }: EquipmentDetailProps) {
  const isMobile = useIsMobile();

  const getClearanceLevelColor = (level: number | null) => {
    if (!level) return "bg-gray-100 text-gray-800";
    if (level <= 2) return "bg-green-100 text-green-800";
    if (level <= 4) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getClearanceLevelText = (level: number | null) => {
    if (!level) return "No clearance required";
    if (level <= 2) return `Level ${level} - Basic`;
    if (level <= 4) return `Level ${level} - Intermediate`;
    return `Level ${level} - Advanced`;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex items-start justify-between">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {equipment.category && (
              <Badge variant="secondary" className="text-sm">
                {equipment.category.name}
              </Badge>
            )}
            <Badge
              className={cn("text-sm", getClearanceLevelColor(equipment.requiredClearanceLevel))}
              variant="outline"
            >
              <Shield className="h-3 w-3 mr-1" />
              {getClearanceLevelText(equipment.requiredClearanceLevel)}
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">{equipment.modelName}</h1>
        </div>
      </div>

      <Separator />

      <div className={cn(
        "grid items-start gap-8",
        isMobile ? "grid-cols-1" : "md:grid-cols-2 lg:gap-12"
      )}>
        {/* Equipment Image */}
        <div className="relative">
          <img
            src={equipment.imagePath ? `/api/images/${equipment.imagePath}` : "/equipment-placeholder.svg"}
            alt={equipment.modelName}
            className={cn(
              "w-full rounded-lg border object-cover",
              isMobile ? "aspect-video max-h-64" : "aspect-4/3 h-[410px]"
            )}
          />
          {equipment.isActive && (
            <div className="absolute top-4 left-4 rounded-full bg-green-500 px-3 py-1 text-xs font-medium text-white">
              Available
            </div>
          )}
        </div>

        {/* Equipment Details */}
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Equipment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {equipment.description && (
                <div className="grid gap-2">
                  <div className="text-sm font-medium text-gray-500">Description</div>
                  <div className="text-lg text-gray-600">{equipment.description}</div>
                </div>
              )}

              {equipment.category && (
                <div className="grid gap-2">
                  <div className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    Category
                    {equipment.category.description && (
                      <HoverCard>
                        <HoverCardTrigger>
                          <Info className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                        </HoverCardTrigger>
                        <HoverCardContent side="top">
                          <div className="flex flex-col gap-1">
                            <h4 className="font-medium">{equipment.category.name}</h4>
                            <p className="text-sm text-gray-600">{equipment.category.description}</p>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    )}
                  </div>
                  <div className="text-lg">{equipment.category.name}</div>
                </div>
              )}

              <div className="grid gap-2">
                <div className="text-sm font-medium text-gray-500">Required Clearance Level</div>
                <Badge
                  className={cn("w-fit", getClearanceLevelColor(equipment.requiredClearanceLevel))}
                  variant="outline"
                >
                  <Shield className="h-3 w-3 mr-1" />
                  {getClearanceLevelText(equipment.requiredClearanceLevel)}
                </Badge>
              </div>

              <div className="grid gap-2">
                <div className="text-sm font-medium text-gray-500">Status</div>
                <Badge
                  variant={equipment.isActive ? "default" : "secondary"}
                  className="w-fit"
                >
                  {equipment.isActive ? "Available for booking" : "Currently unavailable"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
