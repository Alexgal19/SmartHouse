import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-shimmer rounded-md", className)}
      {...props}
    />
  )
}

/* ── Content-matching skeletons ───────────────────────────────────── */

/** Skeleton that mimics a data table (header + N rows) */
function SkeletonTable({ rowCount = 5, colCount = 6, className }: { rowCount?: number; colCount?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex gap-3">
        {Array.from({ length: colCount }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-8 flex-1 animate-shimmer" style={{ animationDelay: `${i * 40}ms` }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rowCount }).map((_, r) => (
        <div key={`r-${r}`} className="flex gap-3">
          {Array.from({ length: colCount }).map((_, c) => (
            <Skeleton
              key={`r${r}-c${c}`}
              className="h-12 flex-1 animate-shimmer"
              style={{ animationDelay: `${(r * colCount + c) * 30 + 100}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Skeleton that mimics a card list (N cards with avatar + text lines) */
function SkeletonCardList({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between pb-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-2/3 animate-shimmer" style={{ animationDelay: `${i * 80}ms` }} />
              <Skeleton className="h-4 w-1/2 animate-shimmer" style={{ animationDelay: `${i * 80 + 40}ms` }} />
            </div>
            <Skeleton className="h-8 w-8 rounded-full animate-shimmer" style={{ animationDelay: `${i * 80 + 60}ms` }} />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full animate-shimmer" style={{ animationDelay: `${i * 80 + 80}ms` }} />
            <Skeleton className="h-4 w-3/4 animate-shimmer" style={{ animationDelay: `${i * 80 + 100}ms` }} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/** Skeleton that mimics an accordion list (N items with header + content hint) */
function SkeletonAccordion({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border rounded-md px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-1/3 animate-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
            <Skeleton className="h-4 w-8 animate-shimmer" style={{ animationDelay: `${i * 60 + 30}ms` }} />
          </div>
          <Skeleton className="h-4 w-full animate-shimmer" style={{ animationDelay: `${i * 60 + 50}ms` }} />
          <Skeleton className="h-4 w-2/3 animate-shimmer" style={{ animationDelay: `${i * 60 + 70}ms` }} />
        </div>
      ))}
    </div>
  )
}

/** Skeleton that mimics stat cards + chart area */
function SkeletonDashboard({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/3 animate-shimmer" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-24 w-full animate-shimmer animation-delay-stagger-1" />
            <Skeleton className="h-24 w-full animate-shimmer animation-delay-stagger-2" />
            <Skeleton className="h-24 w-full animate-shimmer animation-delay-stagger-3" />
            <Skeleton className="h-24 w-full animate-shimmer animation-delay-stagger-4" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/4 animate-shimmer" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full animate-shimmer" />
        </CardContent>
      </Card>
    </div>
  )
}

export { Skeleton, SkeletonTable, SkeletonCardList, SkeletonAccordion, SkeletonDashboard }
