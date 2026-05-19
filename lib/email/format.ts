import { prisma } from "@/lib/prisma";

const DEFAULT_TIMEZONE = "Europe/London";

export async function getTenantTimezone(tenantId: string): Promise<string> {
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { timezone: true, schoolName: true },
  });
  return settings?.timezone || DEFAULT_TIMEZONE;
}

export async function getTenantEmailBranding(tenantId: string): Promise<{
  schoolName: string;
  timezone: string;
}> {
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { timezone: true, schoolName: true },
  });
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  return {
    schoolName: settings?.schoolName || tenant?.name || "Your school",
    timezone: settings?.timezone || DEFAULT_TIMEZONE,
  };
}

export function formatDateTime(date: Date, timezone: string): string {
  return date.toLocaleString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

export function formatDateRange(start: Date, end: Date, timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  };
  return `${start.toLocaleDateString("en-GB", opts)} – ${end.toLocaleDateString("en-GB", opts)}`;
}

export function getAppUrl(): string {
  return process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000";
}
