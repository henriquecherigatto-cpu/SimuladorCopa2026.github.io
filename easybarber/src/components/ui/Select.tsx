import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, placeholder, className, id, children, ...props }, ref) => {
    const selectId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-brand-graphite"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              "h-11 w-full appearance-none rounded-xl border bg-white px-3.5 pr-10 text-sm text-brand-graphite",
              "outline-none transition-colors focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20",
              "disabled:bg-brand-surface disabled:text-brand-graphite/40",
              error ? "border-brand-error" : "border-black/10",
              className,
            )}
            aria-invalid={!!error}
            {...(props.value === undefined && props.defaultValue === undefined
              ? { defaultValue: placeholder ? "" : undefined }
              : {})}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brand-graphite/40" />
        </div>
        {error && <p className="text-xs text-brand-error">{error}</p>}
      </div>
    );
  },
);
Select.displayName = "Select";
