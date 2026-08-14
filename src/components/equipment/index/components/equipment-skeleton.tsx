import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

export function EquipmentSkeleton() {
  return (
    <Card>
      <CardHeader className="p-0">
        {/* Image skeleton */}
        <Skeleton className="aspect-video w-full rounded-t-lg rounded-b-none" />
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
