"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/form-field";

function splitDateTime(value: string): { date: string; time: string } {
  const [date, time] = value.split("T");
  return { date: date ?? "", time: time ?? "00:00" };
}

export function LeaveDateTimeFields({
  defaultValue,
  initialStart = "",
  initialEnd = "",
}: {
  defaultValue: string;
  /** Values sent back after a rejected submit. */
  initialStart?: string;
  initialEnd?: string;
}) {
  const initial = splitDateTime(defaultValue);
  const start = initialStart ? splitDateTime(initialStart.includes("T") ? initialStart : `${initialStart}T${initial.time}`) : initial;
  const end = initialEnd ? splitDateTime(initialEnd.includes("T") ? initialEnd : `${initialEnd}T${initial.time}`) : initial;
  const [allDay, setAllDay] = useState(!initialStart.includes("T"));
  const [startDate, setStartDate] = useState(start.date);
  const [startTime, setStartTime] = useState(start.time);
  const [endDate, setEndDate] = useState(end.date);
  const [endTime, setEndTime] = useState(end.time);

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
      {!allDay ? <p className="-mt-2 text-[12px] text-[#6e6e73]">Use times for part of a day, like an appointment.</p> : null}

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
              onChange={(e) => {
                const v = e.target.value;
                setStartDate(v);
                // Keep the end from sitting before the start.
                if (v && (!endDate || endDate < v)) setEndDate(v);
              }}
              className="field min-w-0 flex-1"
            />
            {!allDay ? (
              <input
                aria-label="Start time"
                required
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="field !w-32 shrink-0"
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
              ? "Your last day off."
              : "When you're back."
          }
        >
          <div className="flex gap-2">
            <input
              id="loa-end"
              required
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="field min-w-0 flex-1"
            />
            {!allDay ? (
              <input
                aria-label="End time"
                required
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="field !w-32 shrink-0"
              />
            ) : null}
          </div>
        </FormField>
      </div>
    </div>
  );
}
