import { cn } from '../../lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse bg-concreto-100 rounded-xl', className)} />
}

export function ListingCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-concreto-100 overflow-hidden">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-2/5" />
        <div className="flex justify-between items-center mt-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-concreto-100 p-6">
      <div className="flex items-start gap-4">
        <Skeleton className="w-20 h-20 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  )
}
