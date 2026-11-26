"use client";

import { useState } from "react";
import { FormSelect } from "@/components/ui/form-select";
import { LEAVE_MEDICAL_MIN_BUSINESS_DAYS } from "@/lib/leavePolicy";
import styles from "./page.module.css";

export type LeaveReasonOption = {
  id: string;
  label: string;
  requiresMedicalEvidence: boolean;
};

export function LeaveReasonFields({
  reasons,
  defaultReasonId = "",
}: {
  reasons: LeaveReasonOption[];
  defaultReasonId?: string;
}) {
  const initialReason = reasons.some((r) => r.id === defaultReasonId) ? defaultReasonId : "";
  const [reasonId, setReasonId] = useState(initialReason);
  const selectedReason = reasons.find((r) => r.id === reasonId);
  const showMedicalEvidence = selectedReason?.requiresMedicalEvidence ?? false;

  return (
    <>
      <div className={styles.card}>
        <p className={styles.label}>Type of leave</p>
        <FormSelect
          name="reasonId"
          defaultValue={initialReason || undefined}
          placeholder="Choose a type"
          triggerClassName="rounded-[10px]"
          options={reasons.map((reason) => ({ value: reason.id, label: reason.label }))}
          onChange={setReasonId}
        />
        <label htmlFor="loa-reason-text" className={`${styles.label} mt-5`}>
          Details <span className="font-normal text-[#6e6e73]">(optional)</span>
        </label>
        <textarea
          id="loa-reason-text"
          name="reasonText"
          maxLength={2000}
          className="field min-h-[96px] w-full resize-y"
          placeholder="Anything your approver should know."
          rows={3}
        />
      </div>

      <div className={styles.card}>
        <label htmlFor="loa-cover" className={styles.label}>
          Cover needed <span className="font-normal text-[#6e6e73]">(optional)</span>
        </label>
        <p className={styles.hint}>Classes, duties or meetings someone else will need to pick up.</p>
        <textarea
          id="loa-cover"
          name="coverRequirements"
          maxLength={2000}
          className="field min-h-[96px] w-full resize-y"
          placeholder="e.g. 9B Maths period 3 Tuesday, Year 10 duty Wednesday"
          rows={3}
        />
      </div>

      {showMedicalEvidence ? (
        <div className={styles.card}>
          <label htmlFor="loa-medical" className={styles.label}>
            Evidence
          </label>
          <p className={styles.hint}>
            Needed for {LEAVE_MEDICAL_MIN_BUSINESS_DAYS} or more working days. PDF, JPG or PNG, up to 5MB. Only you and the people
            who approve your leave can open it.
          </p>
          <div className={styles.drop}>
            <input
              id="loa-medical"
              type="file"
              name="medicalEvidence"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="max-w-full text-[13px] text-[#6e6e73]"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
