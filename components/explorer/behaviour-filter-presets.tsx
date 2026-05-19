"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "anaxi-behaviour-analysis-presets";

export type BehaviourFilterPreset = {
  id: string;
  name: string;
  windowDays: number;
  yearGroup: string;
  pp: boolean;
  send: boolean;
};

function loadPresets(): BehaviourFilterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BehaviourFilterPreset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePresets(presets: BehaviourFilterPreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.slice(0, 12)));
}

type Props = {
  current: Omit<BehaviourFilterPreset, "id" | "name">;
};

/** Named filter presets for behaviour analysis (UX-092, stored per browser). */
export function BehaviourFilterPresets({ current }: Props) {
  const [presets, setPresets] = useState<BehaviourFilterPreset[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  const applyPreset = useCallback((p: BehaviourFilterPreset) => {
    const params = new URLSearchParams();
    params.set("windowDays", String(p.windowDays));
    if (p.yearGroup) params.set("yearGroup", p.yearGroup);
    if (p.pp) params.set("pp", "1");
    if (p.send) params.set("send", "1");
    window.location.href = `/explorer/analysis?${params.toString()}`;
  }, []);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const next: BehaviourFilterPreset = {
      id: crypto.randomUUID(),
      name: trimmed,
      ...current,
    };
    const updated = [next, ...presets.filter((p) => p.name !== trimmed)].slice(0, 12);
    savePresets(updated);
    setPresets(updated);
    setName("");
  }

  function removePreset(id: string) {
    const updated = presets.filter((p) => p.id !== id);
    savePresets(updated);
    setPresets(updated);
  }

  return (
    <div className="mt-4 border-t border-border/30 pt-4">
      <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Saved presets</p>
      {presets.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2">
          {presets.map((p) => (
            <li key={p.id} className="flex items-center gap-1">
              <Button type="button" variant="secondary" className="!py-1.5 !text-xs" onClick={() => applyPreset(p)}>
                {p.name}
              </Button>
              <button
                type="button"
                className="rounded-md px-1.5 py-1 text-xs text-muted hover:text-error"
                aria-label={`Remove preset ${p.name}`}
                onClick={() => removePreset(p.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-muted">Save your current filters for one-click recall.</p>
      )}
      <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Preset name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Year 10 PP"
            className="field !py-2 text-sm"
          />
        </label>
        <Button type="submit" variant="secondary" className="shrink-0">
          Save current filters
        </Button>
      </form>
    </div>
  );
}
