import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id ?? props.name ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-brand-graphite"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          rows={3}
          className={cn(
            "w-full resize-none rounded-xl border bg-white px-3.5 py-2.5 text-sm text-brand-graphite placeholder:text-brand-graphite/40",
            "outline-none transition-colors focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20",
            error ? "border-brand-error" : "border-black/10",
            className,
          )}
          aria-invalid={!!error}
          {...props}
        />
        {error && <p className="text-xs text-brand-error">{error}</p>}
        {!error && hint && (
          <p className="text-xs text-brand-graphite/50">{hint}</p>
        )}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";
