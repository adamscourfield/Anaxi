"use client";

import { useState, useRef, useEffect, useMemo, useId } from "react";

export interface SelectOption {
  value: string;
  label: string;
  detail?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  /** Accessible name when no visible label is wired (UX-111). */
  ariaLabel?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  className = "",
  disabled = false,
  ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

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
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.detail?.toLowerCase().includes(q) ?? false),
    );
  }, [query, options]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filtered.length, query]);

  const selectedOption = options.find((o) => o.value === value);
  const activeId = filtered[activeIndex] ? `${listboxId}-opt-${activeIndex}` : undefined;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`field !flex w-full items-center justify-between gap-2 text-left ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
      >
        <span
          className={`min-w-0 truncate text-left ${selectedOption ? "text-text" : "text-muted opacity-60"}`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg viewBox="0 0 16 16" fill="none" className={`h-3.5 w-3.5 shrink-0 text-muted calm-transition ${open ? "rotate-180" : ""}`}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border border-border/80 bg-surface-container-lowest shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-2 rounded-xl bg-divider px-3 py-2">
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0 text-muted">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-controls={listboxId}
                aria-expanded={open}
                aria-activedescendant={activeId}
                aria-autocomplete="list"
                className="w-full border-none bg-transparent text-sm text-text outline-none placeholder:text-muted/60"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpen(false);
                    setQuery("");
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex((i) => Math.max(i - 1, 0));
                    return;
                  }
                  if (e.key === "Enter" && filtered[activeIndex]) {
                    e.preventDefault();
                    onChange(filtered[activeIndex].value);
                    setOpen(false);
                    setQuery("");
                  }
                }}
              />
            </div>
          </div>
          <div
            id={listboxId}
            role="listbox"
            className="max-h-[240px] overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">No results found</p>
            ) : (
              filtered.map((option, index) => (
                <button
                  key={option.value}
                  id={`${listboxId}-opt-${index}`}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm calm-transition ${
                    index === activeIndex
                      ? "bg-accent/[0.06] font-medium text-accent"
                      : option.value === value
                        ? "bg-accent/[0.06] font-medium text-accent"
                        : "text-text hover:bg-bg"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.detail && (
                      <span className="block truncate text-xs text-muted">{option.detail}</span>
                    )}
                  </div>
                  {option.value === value && (
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
