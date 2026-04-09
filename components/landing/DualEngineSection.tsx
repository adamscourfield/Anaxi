"use client";

import { useState } from "react";
import Link from "next/link";

export default function DualEngineSection() {
  const [activeTab, setActiveTab] = useState<"operations" | "pedagogy">("pedagogy");

  return (
    <section id="dual-engine" className="bg-white py-24">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12">
          <div className="max-w-xl">
            <span
              className="inline-block text-xs font-semibold uppercase tracking-[0.2em] mb-4"
              style={{ color: "var(--on-surface-variant)" }}
            >
              Platform Architecture
            </span>
            <h2
              className="text-3xl lg:text-4xl font-semibold tracking-tight"
              style={{ color: "var(--on-surface)" }}
            >
              Dual-Engine Architecture
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--on-surface-variant)" }}>
              The Anaxi ecosystem is split into two specialised pillars, harmonised through a shared data ledger.
            </p>
          </div>

          {/* Tab toggle */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl self-start lg:self-auto shrink-0"
            style={{ background: "var(--surface-container)" }}
          >
            <button
              onClick={() => setActiveTab("operations")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                activeTab === "operations"
                  ? "bg-white shadow-sm"
                  : "hover:bg-white/50"
              }`}
              style={{
                color:
                  activeTab === "operations"
                    ? "var(--on-surface)"
                    : "var(--on-surface-variant)",
              }}
            >
              Operations
            </button>
            <button
              onClick={() => setActiveTab("pedagogy")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                activeTab === "pedagogy" ? "shadow-sm" : "hover:bg-white/50"
              }`}
              style={{
                background:
                  activeTab === "pedagogy" ? "var(--primary-container)" : "transparent",
                color: activeTab === "pedagogy" ? "white" : "var(--on-surface-variant)",
              }}
            >
              Pedagogy
            </button>
          </div>
        </div>

        {/* Two cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Anaxi Core — light card */}
          <div
            id="core"
            className="rounded-2xl p-8 flex flex-col gap-7"
            style={{
              background: "var(--surface-container-low)",
              border: "1px solid var(--outline-variant)",
            }}
          >
            <div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                style={{ background: "var(--surface-container-high)" }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M3 17V8l7-5 7 5v9"
                    stroke="var(--on-surface)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <rect
                    x="7"
                    y="11"
                    width="6"
                    height="6"
                    rx="1"
                    stroke="var(--on-surface)"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
              <h3
                className="text-2xl font-semibold mb-2"
                style={{ color: "var(--on-surface)" }}
              >
                Anaxi Core
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--on-surface-variant)" }}>
                Refined operational confidence. A clinical approach to school logistics and staff governance.
              </p>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-5">
              {[
                { category: "Governance", description: "Staff Management", sub: "Unified records with deep audit trails." },
                { category: "Logistics", description: "On-Call Requests", sub: "Real-time dynamic resource allocation." },
                { category: "Wellbeing", description: "Leave & Absence", sub: "Automated workflows for staff continuity." },
                { category: "Quality", description: "Observations", sub: "Evidence-based appraisal frameworks." },
              ].map((item) => (
                <div key={item.category} className="flex flex-col gap-1">
                  <span
                    className="text-2xs font-semibold uppercase tracking-widest"
                    style={{ color: "var(--on-surface-variant)" }}
                  >
                    {item.category}
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--on-surface)" }}>
                    {item.description}
                  </span>
                  <span className="text-xs" style={{ color: "var(--on-surface-variant)" }}>
                    {item.sub}
                  </span>
                </div>
              ))}
            </div>

            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm font-medium mt-auto transition-opacity duration-150 hover:opacity-70"
              style={{ color: "var(--on-surface)" }}
            >
              Enter the Core Engine
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 7h8M8 4l3 3-3 3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>

          {/* Anaxi Learn — dark card */}
          <div
            id="learn"
            className="rounded-2xl p-8 flex flex-col gap-7"
            style={{ background: "var(--primary-container)" }}
          >
            <div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                style={{ background: "rgba(255,255,255,0.10)" }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="8" r="4" stroke="white" strokeWidth="1.5" />
                  <path
                    d="M7.5 12.5v1.5a2.5 2.5 0 0 0 5 0v-1.5"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10 4V2M6 5.5 4.5 4M14 5.5 15.5 4"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-white mb-2">Anaxi Learn</h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.62)" }}>
                Deep pedagogical integrity. Bridging the gap between cognitive science and classroom delivery.
              </p>
            </div>

            {/* Feature list */}
            <div className="flex flex-col gap-5">
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
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                    style={{ background: "rgba(255,255,255,0.09)" }}
                  >
                    {feature.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{feature.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.52)" }}>
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-colors duration-150 hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.22)" }}
              >
                Explore Learning Science
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 7h8M8 4l3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
