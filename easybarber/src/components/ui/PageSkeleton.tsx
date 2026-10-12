export function PageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 rounded-lg bg-black/10" />
        <div className="h-4 w-64 rounded-lg bg-black/5" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-16 rounded-2xl bg-black/5" />
        <div className="h-16 rounded-2xl bg-black/5" />
        <div className="h-16 rounded-2xl bg-black/5" />
      </div>
    </div>
  );
}
