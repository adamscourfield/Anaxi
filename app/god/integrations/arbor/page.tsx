import Link from "next/link";
import { requireSuperAdminUser } from "@/lib/admin";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { getCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { CsrfInput } from "@/components/CsrfInput";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { MetaText } from "@/components/ui/typography";

export default async function ArborIntegrationPage({ searchParams }: { searchParams?: Promise<{ saved?: string; error?: string; test?: string; preview?: string; total?: string; primary?: string; secondary?: string; offRoll?: string; review?: string; unrecognised?: string | string[]; comparison?: string; alreadyLinked?: string; possibleMatch?: string; ambiguousMatch?: string; newStudent?: string; skippedOffRoll?: string; needsReview?: string }> }) {
  await requireSuperAdminUser();
  const [csrfToken, schools, integration, params] = await Promise.all([
    getCsrfToken(),
    prisma.tenant.findMany({
      where: { id: { not: PLATFORM_TENANT_ID }, status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true, tenantSettings: { select: { schoolType: true } } },
    }),
    (prisma as any).sharedIntegration.findUnique({
      where: { provider: "ARBOR" },
      include: { schools: { where: { enabled: true }, select: { tenantId: true } } },
    }),
    searchParams,
  ]);

  const selected = new Set<string>(integration?.schools.map((school: { tenantId: string }) => school.tenantId) ?? []);
  const hostname = typeof integration?.config?.schoolHostname === "string" ? integration.config.schoolHostname : "";
  const previewCount = (value: string | undefined) => (/^\d+$/.test(value ?? "") ? Number(value) : 0);
  const unrecognisedLevels = Array.isArray(params?.unrecognised)
    ? params.unrecognised
    : params?.unrecognised
      ? [params.unrecognised]
      : [];

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <PageHeader
        variant="ledger"
        eyebrow="God Mode"
        title="Arbor connection"
        subtitle="Connect one Arbor system and choose every Anaxi school that should receive its data."
        actions={<Link href="/god"><Button variant="secondary">Back to schools</Button></Link>}
      />

      {params?.saved === "1" ? (
        <Card className="border-success/30 bg-[var(--pill-success-bg)]">
          <div className="font-medium text-success">Arbor connection saved.</div>
          <MetaText className="mt-1">Its login details are encrypted. The connection will remain inactive until the first sync is built and verified.</MetaText>
        </Card>
      ) : null}

      {params?.error === "secure-storage" ? (
        <Card className="border-danger/30 bg-[var(--pill-danger-bg)]">
          <div className="font-medium text-danger">Arbor details were not saved.</div>
          <MetaText className="mt-1">Secure credential storage has not been configured for this Anaxi environment. Add the integration encryption key in the hosting environment, then try again.</MetaText>
        </Card>
      ) : null}

      {params?.test === "success" ? (
        <Card className="border-success/30 bg-[var(--pill-success-bg)]">
          <div className="font-medium text-success">Arbor connection verified.</div>
          <MetaText className="mt-1">Anaxi can securely read Arbor. No school data has been imported yet.</MetaText>
        </Card>
      ) : null}

      {params?.test === "failed" || params?.test === "not-configured" ? (
        <Card className="border-danger/30 bg-[var(--pill-danger-bg)]">
          <div className="font-medium text-danger">Arbor connection needs attention.</div>
          <MetaText className="mt-1">{params?.test === "not-configured" ? "Save the Arbor application credentials before checking the connection." : integration?.lastSyncError ?? "Try saving the Arbor application credentials again."}</MetaText>
        </Card>
      ) : null}

      {params?.preview === "success" ? (
        <Card className="border-success/30 bg-[var(--pill-success-bg)]">
          <div className="font-medium text-success">Student preview complete.</div>
          <MetaText className="mt-1">{previewCount(params.total)} students found: {previewCount(params.primary)} for Primary, {previewCount(params.secondary)} for Secondary, {previewCount(params.offRoll)} off-roll records skipped, and {previewCount(params.review)} needing review. Nothing has been imported.</MetaText>
          {unrecognisedLevels.length > 0 ? <MetaText className="mt-1">Unrecognised levels: {unrecognisedLevels.join("; ")}.</MetaText> : null}
        </Card>
      ) : null}

      {params?.preview === "failed" || params?.preview === "not-connected" ? (
        <Card className="border-danger/30 bg-[var(--pill-danger-bg)]">
          <div className="font-medium text-danger">Student preview could not run.</div>
          <MetaText className="mt-1">{params?.preview === "not-connected" ? "Check the Arbor connection before previewing students." : "Anaxi could not read the student fields needed for the preview. No data was imported."}</MetaText>
        </Card>
      ) : null}

      {params?.comparison === "success" ? (
        <Card className="border-success/30 bg-[var(--pill-success-bg)]">
          <div className="font-medium text-success">Student comparison complete.</div>
          <MetaText className="mt-1">{previewCount(params.alreadyLinked)} already linked to Arbor, {previewCount(params.possibleMatch)} possible existing Anaxi matches, {previewCount(params.ambiguousMatch)} ambiguous matches, and {previewCount(params.newStudent)} potentially new students. Nothing has been changed.</MetaText>
        </Card>
      ) : null}

      {params?.comparison === "failed" || params?.comparison === "not-connected" ? (
        <Card className="border-danger/30 bg-[var(--pill-danger-bg)]">
          <div className="font-medium text-danger">Student comparison could not run.</div>
          <MetaText className="mt-1">{params?.comparison === "not-connected" ? "Check the Arbor connection before comparing students." : "Anaxi could not compare Arbor students with the existing Anaxi records. No data was changed."}</MetaText>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <div className="font-medium">How this works</div>
        <MetaText>
          Goresbrook Primary and Goresbrook Secondary can share one Arbor connection while remaining separate Anaxi schools. Before the first sync is enabled, we will confirm the Arbor field that distinguishes the two, so no record is guessed into the wrong school.
        </MetaText>
      </Card>

      {integration?.credentialsCiphertext ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">Check the Arbor connection</div>
            <MetaText className="mt-1">This makes one read-only request to Arbor. It does not import or change data.</MetaText>
          </div>
          <form method="post" action="/api/god/integrations/arbor/test">
            <CsrfInput token={csrfToken} />
            <Button type="submit" variant="secondary">Check connection</Button>
          </form>
        </Card>
      ) : null}

      {integration?.status === "CONNECTED" ? (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">Preview student routing</div>
              <MetaText className="mt-1">Nursery–Year 6 routes to Primary; Years 7–13 routes to Secondary; no year group is treated as off-roll. This preview imports nothing.</MetaText>
            </div>
            <form method="post" action="/api/god/integrations/arbor/preview/students">
              <CsrfInput token={csrfToken} />
              <Button type="submit" variant="secondary">Preview students</Button>
            </form>
          </Card>
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">Compare with existing Anaxi students</div>
              <MetaText className="mt-1">This looks for exact name-and-year matches only. It does not merge, add, or change any student.</MetaText>
            </div>
            <form method="post" action="/api/god/integrations/arbor/preview/students/compare">
              <CsrfInput token={csrfToken} />
              <Button type="submit" variant="secondary">Compare students</Button>
            </form>
          </Card>
        </>
      ) : null}

      <Card>
        <form method="post" action="/api/god/integrations/arbor" className="space-y-5">
          <CsrfInput token={csrfToken} />
          <div className="space-y-3">
            <div>
              <div className="font-medium">Arbor application credentials</div>
              <MetaText className="mt-1">Use the dedicated credentials for the Anaxi app in Arbor&apos;s Developer Portal, not a staff member&apos;s Arbor email and password. These details are stored encrypted and are never shown again after saving.</MetaText>
            </div>
            <label className="block text-sm font-medium">
              Arbor school name
              <input name="schoolHostname" required defaultValue={hostname} className="field mt-1 w-full" placeholder="goresbrook" autoCapitalize="none" />
              <MetaText className="mt-1">Enter the part before <code>.uk.arbor.sc</code>, not the full web address.</MetaText>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Arbor API username
                <input name="username" required className="field mt-1 w-full" autoComplete="off" />
                <MetaText className="mt-1">The Anaxi app username from Arbor&apos;s Developer Portal.</MetaText>
              </label>
              <label className="text-sm font-medium">
                Arbor API password
                <input name="password" required type="password" className="field mt-1 w-full" autoComplete="new-password" />
                <MetaText className="mt-1">The matching app password or secret from Arbor&apos;s Developer Portal.</MetaText>
              </label>
            </div>
          </div>

          <fieldset className="space-y-3 border-t border-border/70 pt-5">
            <legend className="font-medium">Schools that receive Arbor data</legend>
            <MetaText>Choose both schools for Goresbrook. Their data stays separated inside Anaxi.</MetaText>
            <div className="grid gap-2 sm:grid-cols-2">
              {schools.map((school) => (
                <label key={school.id} className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface/60 px-3 py-3 text-sm">
                  <input type="checkbox" name="tenantIds" value={school.id} defaultChecked={selected.has(school.id)} className="accent-accent" />
                  <span>
                    <span className="block font-medium">{school.name}</span>
                    <MetaText>{school.tenantSettings?.schoolType === "PRIMARY" ? "Primary" : "Secondary"} · {school.status.toLowerCase()}</MetaText>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Button type="submit">Save Arbor connection</Button>
        </form>
      </Card>
    </div>
  );
}
