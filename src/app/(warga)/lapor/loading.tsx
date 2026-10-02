import { Skeleton } from "@/components/ui/skeleton";

export default function LaporLoading() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-[420px] w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
