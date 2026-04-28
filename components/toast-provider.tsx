"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "default" | "success" | "error";

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  push: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Imperative API for client components */
let toastDispatch: ToastContextValue["push"] | null = null;

export function toast(message: string, variant: ToastVariant = "default") {
  toastDispatch?.(message, variant);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback((message: string, variant: ToastVariant = "default") => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setItems((prev) => [...prev.slice(-4), { id, message, variant }]);
    const tid = setTimeout(() => remove(id), variant === "error" ? 6500 : 4200);
    timers.current.set(id, tid);
  }, [remove]);

  useEffect(() => {
    toastDispatch = push;
    return () => {
      toastDispatch = null;
    };
  }, [push]);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-0 right-0 z-[200] flex max-w-[min(100vw-1.5rem,24rem)] flex-col gap-2 p-4 sm:p-6"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => remove(t.id)}
            className={`pointer-events-auto w-full rounded-xl border px-4 py-3 text-left text-sm font-medium shadow-lg calm-transition motion-safe:animate-toast-in ${
              t.variant === "success"
                ? "border-emerald-200/80 bg-emerald-50 text-emerald-950"
                : t.variant === "error"
                  ? "border-red-200/80 bg-red-50 text-red-950"
                  : "border-[color-mix(in_srgb,var(--outline-variant)_50%,transparent)] bg-[var(--surface-container-lowest)] text-text shadow-[var(--shadow-md)]"
            }`}
          >
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
