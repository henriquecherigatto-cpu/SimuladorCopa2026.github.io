import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";

export function Avatar({
  name,
  color = "#FF6B1A",
  photoUrl,
  size = "md",
  className,
}: {
  name: string;
  color?: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "size-7 text-xs",
    md: "size-9 text-sm",
    lg: "size-12 text-base",
  };

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- photos live in Supabase Storage, not /public; next/image can't optimize an arbitrary remote origin without extra config.
      <img
        src={photoUrl}
        alt={name}
        className={cn(
          "inline-flex shrink-0 rounded-full object-cover",
          sizeClasses[size],
          className,
        )}
      />
    );
  }

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
