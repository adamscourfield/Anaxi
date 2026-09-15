"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/form-field";

function splitDateTime(value: string): { date: string; time: string } {
  const [date, time] = value.split("T");
  return { date: date ?? "", time: time ?? "00:00" };
}

export function LeaveDateTimeFields({ defaultValue }: { defaultValue: string }) {
  const initial = splitDateTime(defaultValue);
  const [allDay, setAllDay] = useState(true);
  const [startDate, setStartDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.time);
  const [endDate, setEndDate] = useState(initial.date);
  const [endTime, setEndTime] = useState(initial.time);

  const startAt = allDay ? startDate : `${startDate}T${startTime}`;
  const endAt = allDay ? endDate : `${endDate}T${endTime}`;

  return (
    <div className="space-y-4">
      <label className="inline-flex items-center gap-2.5 text-[0.8125rem] font-medium text-text">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          className="h-4 w-4 rounded border-[color-mix(in_srgb,var(--outline-variant)_60%,transparent)] text-accent focus:ring-2 focus:ring-accent/40"
        />
        All day
      </label>

      <input type="hidden" name="startAt" value={startAt} />
      <input type="hidden" name="endAt" value={endAt} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField id="loa-start" label="Start" required>
          <div className="flex gap-2">
            <input
              id="loa-start"
              required
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="field rounded-xl bg-[var(--surface-container-low)]/80"
            />
            {!allDay ? (
              <input
                aria-label="Start time"
                required
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="field w-32 shrink-0 rounded-xl bg-[var(--surface-container-low)]/80"
              />
            ) : null}
          </div>
        </FormField>
        <FormField
          id="loa-end"
          label="End"
          required
          hint={
            allDay
              ? "Last day of absence (inclusive)."
              : "Last moment of absence (inclusive)."
          }
        >
          <div className="flex gap-2">
            <input
              id="loa-end"
              required
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="field rounded-xl bg-[var(--surface-container-low)]/80"
            />
            {!allDay ? (
              <input
                aria-label="End time"
                required
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="field w-32 shrink-0 rounded-xl bg-[var(--surface-container-low)]/80"
              />
            ) : null}
          </div>
        </FormField>
      </div>
    </div>
  );
}
