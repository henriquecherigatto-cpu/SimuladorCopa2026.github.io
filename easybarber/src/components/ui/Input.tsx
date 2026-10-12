import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, className, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? props.name ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-brand-graphite"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-graphite/40">
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-brand-graphite placeholder:text-brand-graphite/40",
              "outline-none transition-colors focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20",
              "disabled:bg-brand-surface disabled:text-brand-graphite/40",
              leftIcon && "pl-10",
              error ? "border-brand-error" : "border-black/10",
              className,
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-brand-error">
            {error}
          </p>
        )}
        {!error && hint && (
          <p className="text-xs text-brand-graphite/50">{hint}</p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";
