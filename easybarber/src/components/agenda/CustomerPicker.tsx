"use client";

import * as React from "react";
import { Search, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

export interface CustomerOption {
  id: string;
  name: string;
  phone: string;
}

export function CustomerPicker({
  value,
  onChange,
  customers,
}: {
  value: string | null;
  onChange: (customerId: string | null) => void;
  customers: CustomerOption[];
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selected = customers.find((c) => c.id === value);

  React.useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.phone.replace(/\D/g, "").includes(query.replace(/\D/g, "")),
  );

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar name={selected.name} size="sm" />
          <div>
            <p className="text-sm font-medium text-brand-graphite">
              {selected.name}
            </p>
            <p className="text-xs text-brand-graphite/50">{selected.phone}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
          className="text-xs font-medium text-brand-orange hover:underline"
        >
          Trocar
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-graphite/40" />
        <input
          type="text"
          placeholder="Buscar cliente pelo nome ou telefone"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          className="h-11 w-full rounded-xl border border-black/10 bg-white pl-10 pr-3.5 text-sm text-brand-graphite outline-none transition-colors focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
        />
      </div>
      {open && (
        <div className="absolute z-10 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-black/10 bg-white py-1.5 shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3.5 py-2.5 text-sm text-brand-graphite/50">
              Nenhum cliente encontrado.
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-brand-surface",
                )}
              >
                <Avatar name={c.name} size="sm" />
                <div>
                  <p className="text-sm font-medium text-brand-graphite">
                    {c.name}
                  </p>
                  <p className="text-xs text-brand-graphite/50">{c.phone}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function NewCustomerFields({
  name,
  phone,
  onChangeName,
  onChangePhone,
}: {
  name: string;
  phone: string;
  onChangeName: (v: string) => void;
  onChangePhone: (v: string) => void;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-brand-orange/40 bg-brand-orange/5 p-3">
      <UserPlus className="mt-2 size-4 shrink-0 text-brand-orange" />
      <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-2">
        <input
          type="text"
          placeholder="Nome do novo cliente"
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          className="h-10 rounded-lg border border-black/10 bg-white px-3 text-sm text-brand-graphite outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
        />
        <input
          type="tel"
          placeholder="Telefone"
          value={phone}
          onChange={(e) => onChangePhone(e.target.value)}
          className="h-10 rounded-lg border border-black/10 bg-white px-3 text-sm text-brand-graphite outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
        />
      </div>
    </div>
  );
}
