import { Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  size = "md",
  withWordmark = true,
  className,
  wordmarkClassName,
}: {
  size?: "sm" | "md" | "lg";
  withWordmark?: boolean;
  className?: string;
  wordmarkClassName?: string;
}) {
  const iconBox = {
    sm: "size-7",
    md: "size-9",
    lg: "size-14",
  }[size];
  const iconSize = {
    sm: "size-3.5",
    md: "size-4.5",
    lg: "size-7",
  }[size];
  const text = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  }[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl bg-brand-orange text-white",
          iconBox,
        )}
      >
        <Scissors className={iconSize} strokeWidth={2.5} />
      </span>
      {withWordmark && (
        <span
          className={cn(
            "font-bold leading-none text-brand-graphite",
            text,
            wordmarkClassName,
          )}
        >
          Easy
          <br />
          Barber
        </span>
      )}
    </div>
  );
}
