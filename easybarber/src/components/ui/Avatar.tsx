import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";

export function Avatar({
  name,
  color = "#FF6B1A",
  size = "md",
  className,
}: {
  name: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "size-7 text-xs",
    md: "size-9 text-sm",
    lg: "size-12 text-base",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        sizeClasses[size],
        className,
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {getInitials(name)}
    </span>
  );
}
