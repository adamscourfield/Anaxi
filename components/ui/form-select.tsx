"use client";

import { useState, useRef, useEffect, useMemo } from "react";

export interface FormSelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  name: string;
  options: FormSelectOption[];
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  /** Extra classes for the trigger button (e.g. background overrides) */
  triggerClassName?: string;
  searchable?: boolean;
  onChange?: (value: string) => void;
}

export function FormSelect({
  name,
  options,
  defaultValue = "",
  placeholder = "Select…",
  className = "",
  triggerClassName = "",
  searchable = false,
  onChange,
}: FormSelectProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (open && searchable && inputRef.current) inputRef.current.focus();
  }, [open, searchable]);

  const filtered = useMemo(() => {
    if (!searchable) return options;
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, options, searchable]);

  const selectedOption = options.find((o) => o.value === selected);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input type="hidden" name={name} value={selected} />
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`field flex w-full items-center justify-between gap-2 text-left cursor-pointer ${triggerClassName}`}
      >
        <span className={selectedOption ? "text-text truncate" : "text-muted opacity-60 truncate"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={`h-3.5 w-3.5 shrink-0 text-muted calm-transition ${open ? "rotate-180" : ""}`}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border border-border/80 bg-surface-container-lowest shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
          {searchable && (
            <div className="border-b border-border p-2">
              <div className="flex items-center gap-2 rounded-xl bg-divider px-3 py-2">
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0 text-muted">
                  <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  className="w-full border-none bg-transparent text-sm text-text outline-none placeholder:text-muted/60"
                  placeholder="Search…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setOpen(false);
                      setQuery("");
                    }
                  }}
                />
              </div>
            </div>
          )}
          <div className="max-h-[240px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">No results found</p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm calm-transition ${
                    option.value === selected
                      ? "bg-accent/[0.06] font-medium text-accent"
                      : "text-text hover:bg-bg"
                  }`}
                  onClick={() => {
                    setSelected(option.value);
                    onChange?.(option.value);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.value === selected && (
                    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0 text-accent">
                      <path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
