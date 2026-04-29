import { ButtonHTMLAttributes } from "react";

export function TileOption({ selected = false, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      {...props}
      className={`calm-transition rounded-xl border px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 ${selected ? "border-accent bg-accent text-on-primary font-medium shadow-md ring-2 ring-accent/15" : "border-border/80 anx-card text-on-surface hover:border-accent/25 hover:bg-bg"} ${className}`}
    />
  );
}
