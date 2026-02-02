import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

interface EquipmentSkeletonProps {
  viewMode: string;
}

export function EquipmentSkeleton({ viewMode }: EquipmentSkeletonProps) {
  if (viewMode === "grid") {
    return (
      <Card>
        <CardHeader className="p-0">
          {/* Image skeleton */}
          <Skeleton className="h-48 w-full rounded-t-lg rounded-b-none" />
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* Title skeleton */}
          <Skeleton className="h-5 w-3/4" />
          {/* Category skeleton */}
          <Skeleton className="h-4 w-1/2" />
          {/* Badge skeleton */}
          <Skeleton className="h-5 w-20" />
        </CardContent>
        <CardFooter className="p-4 pt-0">
          {/* Button skeleton */}
          <Skeleton className="h-9 w-full" />
        </CardFooter>
      </Card>
    );
  }

  // List view skeleton
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Image skeleton */}
          <Skeleton className="h-24 w-24 rounded-md flex-shrink-0" />
          <div className="flex-1 space-y-4">
            {/* Title skeleton */}
            <Skeleton className="h-5 w-1/3" />
            {/* Category skeleton */}
            <Skeleton className="h-4 w-1/4" />
            {/* Badge skeleton */}
            <Skeleton className="h-5 w-20" />
          </div>
          {/* Button skeleton */}
          <Skeleton className="h-9 w-24 self-center" />
        </div>
      </CardContent>
    </Card>
  );
}
