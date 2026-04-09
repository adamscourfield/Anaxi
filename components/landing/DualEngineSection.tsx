"use client";

import { useState } from "react";
import Link from "next/link";

export default function DualEngineSection() {
  const [activeTab, setActiveTab] = useState<"operations" | "pedagogy">("pedagogy");

  return (
    <section id="dual-engine" className="bg-[var(--surface-bright)] py-24">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12">
          <div className="max-w-xl">
            <h2 className="text-4xl font-semibold text-[var(--on-surface)] tracking-tight mb-3">
              Dual-Engine Architecture
            </h2>
            <p className="text-sm text-[var(--on-surface-variant)] leading-relaxed">
              The Anaxi ecosystem is split into two specialized pillars, harmonized through a shared data ledger.
            </p>
          </div>

          {/* Tab toggle */}
          <div className="flex items-center gap-1 p-1 bg-[var(--surface-container)] rounded-lg self-start lg:self-auto">
            <button
              onClick={() => setActiveTab("operations")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                activeTab === "operations"
                  ? "bg-white text-[var(--on-surface)] shadow-sm"
                  : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
              }`}
            >
              Operations
            </button>
            <button
              onClick={() => setActiveTab("pedagogy")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                activeTab === "pedagogy"
                  ? "bg-[var(--primary-container)] text-white shadow-sm"
                  : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
              }`}
            >
              Pedagogy
            </button>
          </div>
        </div>

        {/* Two cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Anaxi Core — light card */}
          <div id="core" className="bg-white rounded-2xl border border-[var(--outline-variant)] p-8 flex flex-col gap-6">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[var(--surface-container)] flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 17V8l7-5 7 5v9" stroke="var(--on-surface)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="7" y="11" width="6" height="6" rx="1" stroke="var(--on-surface)" strokeWidth="1.5" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-[var(--on-surface)] mb-2">Anaxi Core</h3>
              <p className="text-sm text-[var(--on-surface-variant)] leading-relaxed">
                Refined operational confidence. A clinical approach to school logistics and staff governance.
              </p>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  category: "Governance",
                  description: "Staff Management",
                  sub: "Unified records with deep audit trails.",
                },
                {
                  category: "Logistics",
                  description: "On-Call Requests",
                  sub: "Real-time dynamic resource allocation.",
                },
                {
                  category: "Wellbeing",
                  description: "Leave & Absence",
                  sub: "Automated workflows for staff continuity.",
                },
                {
                  category: "Quality",
                  description: "Observations",
                  sub: "Evidence-based appraisal frameworks.",
                },
              ].map((item) => (
                <div key={item.category} className="flex flex-col gap-1">
                  <span className="text-2xs font-semibold uppercase tracking-widest text-[var(--on-surface-variant)]">
                    {item.category}
                  </span>
                  <span className="text-sm font-medium text-[var(--on-surface)]">{item.description}</span>
                  <span className="text-xs text-[var(--on-surface-variant)]">{item.sub}</span>
                </div>
              ))}
            </div>

            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--on-surface)] hover:text-[var(--on-surface-variant)] transition-colors duration-150 mt-auto"
            >
              Enter the Core Engine
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          {/* Anaxi Learn — dark card */}
          <div id="learn" className="bg-[var(--primary-container)] rounded-2xl p-8 flex flex-col gap-6">
            <div>
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="8" r="4" stroke="white" strokeWidth="1.5" />
                  <path d="M7.5 12.5v1.5a2.5 2.5 0 0 0 5 0v-1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M10 4V2M6 5.5 4.5 4M14 5.5 15.5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-white mb-2">Anaxi Learn</h3>
              <p className="text-sm text-white/70 leading-relaxed">
                Deep pedagogical integrity. Bridging the gap between cognitive science and classroom delivery.
              </p>
            </div>

            {/* Feature list */}
            <div className="flex flex-col gap-4">
              {[
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 12L8 2l6 10H2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                  ),
                  name: "The Mastery Engine",
                  desc: "Machine-learning programme learning curricula.",
                },
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="3" stroke="white" strokeWidth="1.5" />
                      <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  ),
                  name: "Adaptive Diagnostics",
                  desc: "Machine-learning pinpointing learning gaps.",
                },
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8a5 5 0 0 1 10 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M1 11h14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="8" cy="11" r="1.5" fill="white" />
                    </svg>
                  ),
                  name: "Spaced Repetition",
                  desc: "Long-term retention via automated review.",
                },
              ].map((feature) => (
                <div key={feature.name} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center mt-0.5">
                    {feature.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{feature.name}</p>
                    <p className="text-xs text-white/60 mt-0.5">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/30 text-white text-sm font-medium hover:bg-white/10 transition-colors duration-150"
              >
                Explore Learning Science
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
