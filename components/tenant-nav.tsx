"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { FeatureKey, UserRole } from "@/lib/types";
import { hasAnyPermission, hasPermission } from "@/lib/rbac";
import { canAccessTeacherDirectory } from "@/lib/analysisNav";

type NavItem = {
  label: string;
  href: string;
  badgeCount?: number;
  icon: string;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

type NavRail = { y: number; h: number } | null;

function navItemIsActive(pathname: string | null, href: string): boolean {
  if (href === "/home" || href === "/my-actions") return pathname === href;
  if (href === "/admin") {
    return (
      pathname === "/admin" ||
      (pathname?.startsWith("/admin/") === true && !pathname.startsWith("/admin/features"))
    );
  }
  if (href === "/admin/features") {
    return pathname === "/admin/features" || pathname?.startsWith("/admin/features/") === true;
  }
  return pathname?.startsWith(href) ?? false;
}

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const stroke = active ? "var(--on-surface)" : "var(--outline)";
  const common = { viewBox: "0 0 20 20", fill: "none", className: "h-[18px] w-[18px] shrink-0", xmlns: "http://www.w3.org/2000/svg" };

  switch (name) {
    case "home":
      return <svg {...common}><path d="M3.5 8.5 10 3.5l6.5 5v7a1 1 0 0 1-1 1h-3.5v-4.5h-4V16.5H4.5a1 1 0 0 1-1-1v-7Z" stroke={stroke} strokeWidth="1" strokeLinejoin="round" /></svg>;
    case "check-square":
      return <svg {...common}><rect x="3.5" y="3.5" width="13" height="13" rx="2.5" stroke={stroke} strokeWidth="1" /><path d="m6.8 10 2.1 2.1 4.4-4.6" stroke={stroke} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "radar":
      return <svg {...common}><circle cx="10" cy="10" r="6.5" stroke={stroke} strokeWidth="1" /><circle cx="10" cy="10" r="2.5" stroke={stroke} strokeWidth="1" /><path d="M10 3.5v6.5l4.5 4.5" stroke={stroke} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "history":
      return <svg {...common}><path d="M4.5 10A5.5 5.5 0 1 0 6 6.2" stroke={stroke} strokeWidth="1" strokeLinecap="round" /><path d="M4.5 4.5v3h3" stroke={stroke} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 7.2v3l2.2 1.3" stroke={stroke} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "grid":
      return <svg {...common}><rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1.2" stroke={stroke} strokeWidth="1" /><rect x="11" y="3.5" width="5.5" height="5.5" rx="1.2" stroke={stroke} strokeWidth="1" /><rect x="3.5" y="11" width="5.5" height="5.5" rx="1.2" stroke={stroke} strokeWidth="1" /><rect x="11" y="11" width="5.5" height="5.5" rx="1.2" stroke={stroke} strokeWidth="1" /></svg>;
    case "users":
      return <svg {...common}><path d="M6.7 9.1a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2ZM13.6 9.9a2.2 2.2 0 1 0 0-4.4" stroke={stroke} strokeWidth="1" strokeLinecap="round" /><path d="M2.8 15.8a4.4 4.4 0 0 1 7.8-2.6M12.2 15.8a3.5 3.5 0 0 1 5-2" stroke={stroke} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "upload":
      return <svg {...common}><path d="M10 12.8V4.5" stroke={stroke} strokeWidth="1" strokeLinecap="round" /><path d="m6.8 7.7 3.2-3.2 3.2 3.2" stroke={stroke} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 14.5v1a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5v-1" stroke={stroke} strokeWidth="1" strokeLinecap="round" /></svg>;
    case "flag":
      return <svg {...common}><path d="M5 17V4.2a.7.7 0 0 1 .9-.7l7.6 2.2a.9.9 0 0 0 .8-.1l.7-.4v7.4l-.7.4a.9.9 0 0 1-.8.1L5.9 11a.7.7 0 0 0-.9.7" stroke={stroke} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "calendar":
      return <svg {...common}><rect x="3.5" y="4.5" width="13" height="12" rx="2" stroke={stroke} strokeWidth="1" /><path d="M6.5 2.8v3.4M13.5 2.8v3.4M3.5 8.2h13" stroke={stroke} strokeWidth="1" strokeLinecap="round" /></svg>;
    case "moon":
      return <svg {...common}><path d="M13.8 13.9A5.8 5.8 0 0 1 8.4 4.4a6.1 6.1 0 1 0 5.4 9.5Z" stroke={stroke} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "triangle":
      return <svg {...common}><path d="M10 4.2 15.8 15H4.2L10 4.2Z" stroke={stroke} strokeWidth="1" strokeLinejoin="round" /></svg>;
    case "spark":
      return <svg {...common}><path d="M10 3.5 11.7 8.3 16.5 10l-4.8 1.7L10 16.5l-1.7-4.8L3.5 10l4.8-1.7L10 3.5Z" stroke={stroke} strokeWidth="1" strokeLinejoin="round" /></svg>;
    case "strategy":
      return <svg {...common}><path d="M4 5.5h12M4 10h8M4 14.5h5" stroke={stroke} strokeWidth="1" strokeLinecap="round" /><circle cx="14.5" cy="13" r="3" stroke={stroke} strokeWidth="1" /><path d="m16.6 15.1 1.4 1.4" stroke={stroke} strokeWidth="1" strokeLinecap="round" /></svg>;
    case "chart":
      return <svg {...common}><path d="M4 15.5h12" stroke={stroke} strokeWidth="1" strokeLinecap="round" /><path d="M6 13V9.5M10 13V6.5M14 13v-3" stroke={stroke} strokeWidth="1" strokeLinecap="round" /></svg>;
    case "shield":
      return <svg {...common}><path d="M10 3.5 15.5 5.5v4.8c0 3.2-2.3 5.3-5.5 6.2-3.2-.9-5.5-3-5.5-6.2V5.5L10 3.5Z" stroke={stroke} strokeWidth="1" strokeLinejoin="round" /></svg>;
    case "building":
      return <svg {...common}><path d="M4.5 16.5v-10l5.5-2 5.5 2v10" stroke={stroke} strokeWidth="1" strokeLinejoin="round" /><path d="M8 8h.01M12 8h.01M8 11h.01M12 11h.01M9 16.5v-2.8h2v2.8" stroke={stroke} strokeWidth="1" strokeLinecap="round" /></svg>;
    case "toggle":
      return <svg {...common}><rect x="3.5" y="6.2" width="13" height="7.6" rx="3.8" stroke={stroke} strokeWidth="1" /><circle cx="12.8" cy="10" r="2.2" stroke={stroke} strokeWidth="1" /></svg>;
    case "logout":
      return <svg {...common}><path d="M7.5 16.5h-3a1.5 1.5 0 0 1-1.5-1.5V5a1.5 1.5 0 0 1 1.5-1.5h3" stroke={stroke} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /><path d="M13 13.5 16.5 10 13 6.5" stroke={stroke} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /><path d="M16.5 10H7" stroke={stroke} strokeWidth="1" strokeLinecap="round" /></svg>;
    default:
      return <svg {...common}><circle cx="10" cy="10" r="5.5" stroke={stroke} strokeWidth="1" /></svg>;
  }
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg">
      {direction === "left" ? (
        <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function iconFor(href: string) {
  if (href === "/home") return "home";
  if (href === "/my-actions") return "check-square";
  if (href.includes("/observe/history")) return "history";
  if (href.includes("/observe")) return "radar";
  if (href.includes("/instruction")) return "users";
  if (href === "/explorer/teachers") return "users";
  if (href.includes("/explorer")) return "grid";
  if (href.includes("/assessments")) return "chart";
  if (href.includes("/students")) return "users";
  if (href.includes("/behaviour/import")) return "upload";
  if (href.includes("/on-call")) return "flag";
  if (href.includes("/meetings")) return "calendar";
  if (href.includes("/leave")) return "moon";
  if (href.includes("/analytics")) return "chart";
  if (href.includes("/strategy")) return "strategy";
  if (href.includes("/admin/users")) return "users";
  if (href.includes("/admin/departments")) return "building";
  if (href.includes("/admin/features")) return "toggle";
  if (href.includes("/admin")) return "shield";
  if (href === "/god") return "shield";
  return "grid";
}

export function TenantNav({
  role,
  enabledFeatures,
  onCallCount = 0,
  leaveCount = 0,
  coacheeCount = 0,
  variant = "sidebar",
  onNavigate,
}: {
  role: UserRole;
  enabledFeatures: FeatureKey[];
  onCallCount?: number;
  leaveCount?: number;
  coacheeCount?: number;
  variant?: "sidebar" | "drawer";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const isDrawer = variant === "drawer";

  const navRef = useRef<HTMLElement | null>(null);
  const linkRefs = useRef(new Map<string, HTMLAnchorElement | null>());
  const [navRail, setNavRail] = useState<NavRail>(null);

  const registerNavLink = useCallback((href: string, el: HTMLAnchorElement | null) => {
    if (el) linkRefs.current.set(href, el);
    else linkRefs.current.delete(href);
  }, []);

  useEffect(() => {
    if (isDrawer) return;
    const content = document.getElementById("tenant-content");
    if (!content) return;

    const updateMargin = () => {
      const isMobile = window.innerWidth < 768;
      content.style.marginLeft = isMobile
        ? ""
        : collapsed
        ? "var(--sidebar-collapsed-width)"
        : "var(--sidebar-width)";
    };

    updateMargin();
    window.addEventListener("resize", updateMargin);
    return () => window.removeEventListener("resize", updateMargin);
  }, [collapsed, isDrawer]);

  const has = (feature: FeatureKey) => enabledFeatures.includes(feature);
  const canImport = hasPermission(role, "import:write");
  const canAccessAdmin = hasPermission(role, "admin:access");
  const canAccessAdminUsers = hasPermission(role, "admin:users");
  const canAccessAdminSettings = hasPermission(role, "admin:settings");
  const canSeeAnalysis = hasAnyPermission(role, ["analysis:view", "analysis:export"]);
  const canSeeTeacherDirectory = canAccessTeacherDirectory(role, coacheeCount);
  const canViewStrategy = role === "SUPER_ADMIN" || role === "ADMIN" || role === "SLT";

  const navItem = (label: string, href: string, badgeCount?: number): NavItem => ({
    label,
    href,
    badgeCount,
    icon: iconFor(href),
  });

  const sections: NavSection[] = [
    { label: "Overview", items: [navItem("Home", "/home"), navItem("My actions", "/my-actions")] },
    {
      label: "Instruction",
      items: [
        ...(has("OBSERVATIONS") ? [navItem("New observation", "/observe/new")] : []),
        ...(has("OBSERVATIONS") ? [navItem("Observation history", "/observe/history")] : []),
        // Priorities has no standalone nav entry any more — it now lives inside Explorer
        // for whoever can see Explorer. Teachers is Explorer's one exception: a shortcut
        // kept only for roles who can see multiple staff members' data but can't reach
        // Explorer itself (LEADER with coachees, no analysis:view).
        ...(has("ANALYSIS") && canSeeTeacherDirectory && !canSeeAnalysis
          ? [navItem("Teachers", "/explorer/teachers")]
          : []),
        ...(has("ANALYSIS") && canSeeAnalysis ? [navItem("Explorer", "/explorer")] : []),
      ],
    },
    {
      label: "Students",
      items: [
        ...(has("ASSESSMENTS") ? [navItem("Attainment", "/assessments")] : []),
      ...(has("STUDENTS") ? [navItem("Students", "/students")] : []),
        ...(has("STUDENTS_IMPORT") && canImport ? [navItem("Behaviour import", "/behaviour/import")] : []),
        ...(has("ON_CALL") ? [navItem("On call", "/on-call", onCallCount)] : []),
      ],
    },
    {
      label: "Operations",
      items: [
        ...(has("MEETINGS") ? [navItem("Meetings", "/meetings")] : []),
        ...(has("LEAVE") ? [navItem("Leave of absence", "/leave", leaveCount)] : []),
        ...(canViewStrategy ? [navItem("Strategy Board", "/strategy")] : []),
      ],
    },
    {
      label: "Administration",
      items: [
        ...(canAccessAdmin && has("ADMIN") ? [navItem("Administration", "/admin")] : []),
        ...(canAccessAdminSettings && has("ADMIN") ? [navItem("Feature flags", "/admin/features")] : []),
      ],
    },
    ...(role === "SUPER_ADMIN" ? [{ label: "Platform", items: [navItem("God Mode", "/god")] }] : []),
  ].filter((section) => section.items.length > 0);

  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  const updateNavRail = useCallback(() => {
    if (collapsed) {
      setNavRail(null);
      return;
    }
    const root = navRef.current;
    if (!root) {
      setNavRail(null);
      return;
    }
    let activeHref: string | null = null;
    for (const section of sectionsRef.current) {
      for (const item of section.items) {
        if (navItemIsActive(pathname, item.href)) {
          activeHref = item.href;
          break;
        }
      }
      if (activeHref) break;
    }
    if (!activeHref) {
      setNavRail(null);
      return;
    }
    const link = linkRefs.current.get(activeHref);
    if (!link) {
      setNavRail(null);
      return;
    }
    const rootRect = root.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    setNavRail({
      y: linkRect.top - rootRect.top + root.scrollTop,
      h: linkRect.height,
    });
  }, [collapsed, pathname]);

  useLayoutEffect(() => {
    updateNavRail();
  }, [updateNavRail]);

  useEffect(() => {
    const root = navRef.current;
    if (!root) return;
    root.addEventListener("scroll", updateNavRail, { passive: true });
    window.addEventListener("resize", updateNavRail);
    return () => {
      root.removeEventListener("scroll", updateNavRail);
      window.removeEventListener("resize", updateNavRail);
    };
  }, [updateNavRail]);

  const sidebarWidth = collapsed ? "w-[var(--sidebar-collapsed-width)]" : "w-[var(--sidebar-width)]";

  const shellClass = isDrawer
    ? "fixed left-0 top-0 z-50 flex h-screen w-[min(100vw,280px)] max-w-[min(100vw,280px)] flex-col border-r border-border calm-transition glass-surface"
    : `hidden md:flex fixed left-0 top-0 z-30 h-screen flex-col border-r border-border calm-transition glass-surface ${sidebarWidth}`;

  return (
    <aside
      id={isDrawer ? "tenant-nav-drawer" : undefined}
      className={shellClass}
      aria-label={isDrawer ? "Main menu" : "Sidebar menu"}
    >
      {/* Logo area */}
      <div className={`flex items-center ${collapsed ? "justify-center px-2" : "px-5"} h-14 shrink-0`}>
        <Link
          href="/home"
          onClick={() => isDrawer && onNavigate?.()}
          className={`flex items-center ${collapsed ? "justify-center" : "gap-3"} group calm-transition rounded-md ${collapsed ? "p-1" : "px-1 py-0.5 -mx-1"} motion-safe:group-hover:-translate-y-px motion-safe:group-active:scale-[0.99]`}
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center calm-transition">
            <Image src="/anaxi-logo.png" alt="Anaxi" width={22} height={22} priority className="h-[22px] w-[22px] object-contain" />
          </span>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-sans text-[13px] font-bold tracking-[0.04em] uppercase text-[var(--on-surface)]">
                Anaxi
              </span>
              <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-[var(--outline)]">Future Education</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav ref={navRef} className="relative flex-1 overflow-y-auto px-3 pb-4 pt-6">
        {!collapsed && navRail ? (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-0 z-10 w-0.5 rounded-r-sm bg-[var(--on-surface)] motion-reduce:transition-none"
            style={{
              height: navRail.h,
              transform: `translateY(${navRail.y}px)`,
              transition:
                "transform 0.48s cubic-bezier(0.175, 0.72, 0.35, 1.12), height 0.48s cubic-bezier(0.175, 0.72, 0.35, 1.12)",
            }}
          />
        ) : null}
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--outline)]">
                  {section.label}
                </div>
              )}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = navItemIsActive(pathname, item.href);
                  const showBadge = (item.badgeCount ?? 0) > 0;
                  return (
                    <li key={item.href} className="relative">
                      <Link
                        ref={(el) => registerNavLink(item.href, el)}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        onClick={() => isDrawer && onNavigate?.()}
                        className={`group flex items-center ${collapsed ? "justify-center px-2" : "justify-between pl-5 pr-3"} rounded-sm py-2 calm-transition motion-safe:active:scale-[0.99] ${
                          active
                            ? "border border-border bg-[var(--surface-container)] text-[var(--on-surface)] font-semibold"
                            : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface)] motion-safe:hover:translate-x-0.5"
                        }`}
                      >
                        <span className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5"} min-w-0`}>
                          <NavIcon name={item.icon} active={!!active} />
                          {!collapsed && <span className="truncate text-[13px] leading-tight">{item.label}</span>}
                        </span>
                        {!collapsed && showBadge && (
                          <span className="ml-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-md px-1.5 text-[10px] font-semibold bg-[var(--surface-container-highest)] text-[var(--on-surface)]">
                            {item.badgeCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Bottom: sign out + collapse */}
      <div className="px-3 py-3">
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          <div className={collapsed ? "" : "flex-1"}>
            <button
              type="button"
              title={collapsed ? "Log out" : undefined}
              onClick={() => {
                const q = new URLSearchParams({
                  callbackUrl: "/login",
                  returnTo: pathname || "/home",
                });
                router.push(`/login/sign-out?${q.toString()}`);
              }}
              className={`group flex items-center ${collapsed ? "justify-center px-2" : "gap-2.5 pl-5 pr-3"} w-full rounded-md py-2 text-[var(--on-surface-variant)] calm-transition hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface)] motion-safe:hover:translate-x-0.5 motion-safe:active:scale-[0.99]`}
            >
              <NavIcon name="logout" active={false} />
              {!collapsed && <span className="text-[13px]">Log out</span>}
            </button>
          </div>
          {!collapsed && !isDrawer && (
            <button
              onClick={() => setCollapsed(true)}
              className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--outline)] calm-transition hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface)]"
              type="button"
              title="Collapse navigation"
            >
              <ChevronIcon direction="left" />
            </button>
          )}
        </div>
      </div>

      {collapsed && !isDrawer && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute -right-3.5 top-20 z-40 inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] backdrop-blur-sm calm-transition hover:text-[var(--on-surface)] motion-safe:active:scale-95"
          type="button"
          title="Expand navigation"
        >
          <ChevronIcon direction="right" />
        </button>
      )}
    </aside>
  );
}
