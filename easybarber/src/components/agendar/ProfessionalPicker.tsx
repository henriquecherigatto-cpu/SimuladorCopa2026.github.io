"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import type { PublicProfessional } from "@/lib/actions/public-booking";

/**
 * A native <select> can't render an <img> inside an <option>, so
 * showing each professional's photo in the picker needs a hand-rolled
 * dropdown instead of <Select>.
 */
export function ProfessionalPicker({
  label,
  placeholder,
  professionals,
  value,
  onChange,
  disabled,
  error,
}: {
  label: string;
  placeholder: string;
  professionals: PublicProfessional[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const selected = professionals.find((p) => p.id === value) ?? null;
  // Derived, not synced via an effect: becoming disabled (e.g. the
  // service was cleared) closes the panel without needing a second
  // render to react to a state update.
  const effectivelyOpen = open && !disabled;

  React.useEffect(() => {
    if (!effectivelyOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [effectivelyOpen]);

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {label && (
        <span className="text-sm font-medium text-brand-graphite">{label}</span>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={effectivelyOpen}
          className={cn(
            "flex h-11 w-full items-center gap-2.5 rounded-xl border bg-white px-3.5 pr-10 text-left text-sm text-brand-graphite",
            "outline-none transition-colors focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20",
            "disabled:bg-brand-surface disabled:text-brand-graphite/40",
            error ? "border-brand-error" : "border-black/10",
          )}
        >
          {selected ? (
            <>
              <Avatar
                name={selected.name}
                color={selected.color}
                photoUrl={selected.photo_url}
                size="sm"
              />
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span className="truncate text-brand-graphite/40">{placeholder}</span>
          )}
        </button>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brand-graphite/40" />

        {effectivelyOpen && (
          <div
            role="listbox"
            className="scrollbar-thin absolute z-10 mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border border-black/10 bg-white py-1.5 shadow-lg"
          >
            {professionals.length === 0 ? (
              <p className="px-3.5 py-2 text-sm text-brand-graphite/40">
                Nenhum profissional disponível
              </p>
            ) : (
              professionals.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={p.id === value}
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-brand-surface",
                    p.id === value
                      ? "bg-brand-orange/10 text-brand-orange-dark"
                      : "text-brand-graphite",
                  )}
                >
                  <Avatar name={p.name} color={p.color} photoUrl={p.photo_url} size="sm" />
                  <span className="truncate">{p.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-brand-error">{error}</p>}
    </div>
  );
}
