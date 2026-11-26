"use client";

import { canViewStrategy } from "@/modules/strategy/access";
import { NavIcon } from "@/components/nav-icons";
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
  if (href.startsWith("/classes")) return "board";
  if (href.includes("/observe/history")) return "history";
  if (href.includes("/observe")) return "eye";
  if (href.includes("/instruction")) return "users";
  if (href === "/insights/teaching/evidence" || href === "/insights/teaching") return "users";
  if (href.includes("/insights/priorities")) return "chart";
  if (href.includes("/insights")) return "grid";
  if (href.includes("/assessments")) return "chart";
  if (href.includes("/students")) return "cap";
  if (href.includes("/on-call")) return "flag";
  if (href.includes("/meetings")) return "calendar";
  if (href.includes("/leave")) return "suitcase";
  if (href.includes("/strategy")) return "target";
  if (href.includes("/admin/users")) return "users";
  if (href.includes("/admin/departments")) return "building";
  if (href.includes("/admin/features")) return "toggle";
  if (href.includes("/admin/import") || href.includes("/import")) return "upload";
  if (href.includes("/admin")) return "gear";
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
  const canSeeStrategy = canViewStrategy(role);
  const studentsHref = "/students";

  const navItem = (label: string, href: string, badgeCount?: number): NavItem => ({
    label,
    href,
    badgeCount,
    icon: iconFor(href),
  });

  const sections: NavSection[] = [
    { label: "Overview", items: [navItem("Home", "/home"), ...(has("MEETINGS") && hasPermission(role, "actions:view_own") ? [navItem("My actions", "/my-actions")] : []), ...(has("ANALYSIS") && canSeeAnalysis ? [navItem("Insights", "/insights")] : [])] },
    {
      label: "Instruction",
      items: [
        ...(has("OBSERVATIONS") && hasPermission(role, "observe:create") ? [navItem("New observation", "/observe/new")] : []),
        ...(has("OBSERVATIONS") ? [navItem("Observation history", "/observe/history")] : []),
        // Priorities has no standalone nav entry any more — it now lives inside Explorer
        // for whoever can see Explorer. Teachers is Explorer's one exception: a shortcut
        // kept only for roles who can see multiple staff members' data but can't reach
        // Explorer itself (LEADER with coachees, no analysis:view).
        ...(has("ANALYSIS") && canSeeTeacherDirectory && !canSeeAnalysis
          ? [navItem("Teachers", "/insights/teaching")]
          : []),

      ],
    },
    {
      label: "Students",
      items: [
        ...(has("ASSESSMENTS") ? [navItem("Attainment", "/assessments")] : []),
        ...(has("STUDENTS") ? [navItem("Students", studentsHref)] : []),
        // Classes shows pupil outcomes, so it follows the Students area's rules.
        ...(has("STUDENTS") && hasPermission(role, "students:read") ? [navItem("Classes", "/classes")] : []),
        ...(has("ON_CALL") ? [navItem("On call", "/on-call", onCallCount)] : []),
      ],
    },
    {
      label: "Operations",
      items: [
        ...(has("MEETINGS") ? [navItem("Meetings", "/meetings")] : []),
        ...(has("LEAVE") ? [navItem("Leave of absence", "/leave", leaveCount)] : []),
        ...(has("STRATEGY") && canSeeStrategy ? [navItem("Strategy Board", "/strategy")] : []),
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
                        aria-current={active ? "page" : undefined}
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
