import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface EquipmentCardItem {
  id: number;
  imagePath: string | null;
  modelName: string;
  description?: string | null;
  category?: { name: string } | null;
}

interface EquipmentCardProps {
  item: EquipmentCardItem;
  linkVariant?: "detail" | "admin-edit";
  colorDot?: string;
}

/**
 * EquipmentCard renders a clickable equipment summary card (image, model name,
 * category, description) with an external-link affordance.
 *
 * @param item - Equipment-like object
 * @param linkVariant - Where the card links to: the public equipment detail
 *   page ("detail") or the admin edit page ("admin-edit")
 * @param colorDot - Optional Tailwind class for a colored dot shown before the
 *   model name (used to tie equipment to calendar event colors)
 */
export function EquipmentCard({ item, linkVariant = "detail", colorDot }: EquipmentCardProps) {
  const content = (
    <Card className="transition-shadow cursor-pointer border-2 hover:border-primary/50 hover:shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-start gap-6">
          <div className="relative shrink-0">
            {item.imagePath ? (
              <img
                src={`/api/images/${item.imagePath}`}
                alt={item.modelName}
                className="h-24 w-24 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-muted">
                <span className="text-xs text-muted-foreground">No image</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold">
                  {colorDot && (
                    <span className={`inline-flex size-2.5 shrink-0 rounded-full ${colorDot}`} aria-hidden="true" />
                  )}
                  {item.modelName}
                </h3>
                {item.category?.name && (
                  <p className="mb-2 text-sm text-muted-foreground">{item.category.name}</p>
                )}
                {item.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                )}
              </div>
              <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (linkVariant === "admin-edit") {
    return (
      <Link to="/admin/equipment/$equipmentId/edit" params={{ equipmentId: item.id.toString() }} className="block">
        {content}
      </Link>
    );
  }

  return (
    <Link to="/equipment/$" params={{ _splat: item.id.toString() }} className="block">
      {content}
    </Link>
  );
}
