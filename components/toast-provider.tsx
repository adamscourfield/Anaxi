"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ToastVariant = "default" | "success" | "error";

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;

function variantStyles(variant: ToastVariant): string {
  switch (variant) {
    case "success":
      return "border-status-approved-border bg-status-approved-bg text-status-approved-text";
    case "error":
      return "border-[color-mix(in_srgb,var(--error)_35%,transparent)] bg-[var(--error-container)] text-[var(--on-error-container)]";
    default:
      return "border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-surface-container-lowest text-[var(--on-surface)] shadow-lg";
  }
}

export function toast(message: string, variant: ToastVariant = "default") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("anaxi-toast", { detail: { message, variant } }),
    );
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  useEffect(() => {
    function onToast(e: Event) {
      const ce = e as CustomEvent<{ message: string; variant: ToastVariant }>;
      const message = ce.detail?.message ?? "";
      const variant = ce.detail?.variant ?? "default";
      if (!message.trim()) return;

      const id = ++toastId;
      setItems((prev) => [...prev, { id, message, variant }]);

      const ms = variant === "error" ? 6500 : 4200;
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), ms),
      );
    }

    window.addEventListener("anaxi-toast", onToast as EventListener);
    return () => window.removeEventListener("anaxi-toast", onToast as EventListener);
  }, [dismiss]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => clearTimeout(t));
    },
    [],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: (message, variant = "default") => {
        window.dispatchEvent(
          new CustomEvent("anaxi-toast", { detail: { message, variant } }),
        );
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-0 right-0 z-[100] flex max-w-[min(100vw-1.5rem,24rem)] flex-col gap-2 p-4 sm:p-5"
        aria-label="Notifications"
      >
        <div aria-live="polite" aria-relevant="additions" className="flex flex-col gap-2">
          {items
            .filter((t) => t.variant !== "error")
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => dismiss(t.id)}
                className={`pointer-events-auto motion-safe:animate-toast-in rounded-xl border px-4 py-3 text-left text-sm font-medium leading-snug shadow-md calm-transition hover:opacity-95 ${variantStyles(
                  t.variant,
                )}`}
                aria-label={`Dismiss: ${t.message}`}
              >
                {t.message}
              </button>
            ))}
        </div>
        <div aria-live="assertive" aria-relevant="additions" className="flex flex-col gap-2">
          {items
            .filter((t) => t.variant === "error")
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => dismiss(t.id)}
                className={`pointer-events-auto motion-safe:animate-toast-in rounded-xl border px-4 py-3 text-left text-sm font-medium leading-snug shadow-md calm-transition hover:opacity-95 ${variantStyles(
                  t.variant,
                )}`}
                aria-label={`Dismiss error: ${t.message}`}
              >
                {t.message}
              </button>
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: (message, variant = "default") => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("anaxi-toast", { detail: { message, variant } }),
          );
        }
      },
    };
  }
  return ctx;
}
