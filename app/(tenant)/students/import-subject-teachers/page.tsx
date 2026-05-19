import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetaText } from "@/components/ui/typography";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function SubjectTeacherImportPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        variant="ledger"
        title="Import subject teachers"
        subtitle="Upload a CSV to link teachers to student subjects."
        eyebrow={
          <Breadcrumb
            items={[
              { label: "Students", href: "/students" },
              { label: "Import subject teachers" },
            ]}
          />
        }
      />
      <Card>
        <form action="/api/students/import-subject-teachers" method="post" encType="multipart/form-data" className="space-y-3">
          <input type="file" name="file" accept=".csv" required className="block text-sm text-text file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm" />
          <Button type="submit">Upload and process</Button>
        </form>
      </Card>
      <MetaText>Required columns: UPN, Subject, TeacherEmail, EffectiveFrom, EffectiveTo(optional).</MetaText>
    </div>
  );
}
