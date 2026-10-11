"use client";

import { useState, useRef, useEffect, useLayoutEffect, useId } from "react";
import type { CSSProperties, ReactNode, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import styles from "./QuickActionButton.module.css";

type QuickActionItem = { label: string; href: string; icon: ReactNode };

export function QuickActionButton({ items }: { items: QuickActionItem[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open) { setPosition(null); return; }
    function placeMenu() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(264, window.innerWidth - 32);
      const height = Math.min(items.length * 48 + 42, window.innerHeight - 24);
      const top = rect.bottom + 8 + height <= window.innerHeight - 12
        ? rect.bottom + 8 : Math.max(12, rect.top - height - 8);
      setPosition({ top, left: Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16)), width, maxHeight: window.innerHeight - top - 12 });
    }
    placeMenu();
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => { window.removeEventListener("resize", placeMenu); window.removeEventListener("scroll", placeMenu, true); };
  }, [open, items.length]);

  useEffect(() => {
    if (open && position) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    // Focus once when the panel mounts, not on scroll/resize repositioning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, !!position]);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss, true);
    return () => document.removeEventListener("pointerdown", dismiss, true);
  }, [open]);

  function onMenuKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); buttonRef.current?.focus(); return; }
    if (event.key === "Tab") { setOpen(false); buttonRef.current?.focus(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const links = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = links.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
    links[next]?.focus();
  }

  if (!items.length) return null;
  return <>
    <button ref={buttonRef} type="button" className={styles.trigger} aria-label="Quick actions menu" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      onClick={() => setOpen(value => !value)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
      Quick actions
    </button>
    {open && position && createPortal(<div ref={menuRef} id={menuId} role="menu" aria-label="Quick actions" className={styles.menu} style={position} onKeyDown={onMenuKeyDown}>
      <p className={styles.label} aria-hidden="true">Create or request</p>
      {items.map(item => <Link key={item.href} href={item.href} role="menuitem" className={styles.item} onClick={() => setOpen(false)}>
        <span className={styles.icon}>{item.icon}</span><span>{item.label}</span><span className={styles.arrow} aria-hidden="true">↗</span>
      </Link>)}
    </div>, document.body)}
  </>;
}
