import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PetaLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex justify-between gap-2">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-44" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[600px] w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}
