"use client";

export function PrintExportButtons() {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-4 print:hidden">
      <button
        type="button"
        onClick={() => {
          const style = document.createElement("style");
          style.id = "__pdf-export-hint";
          style.textContent = "@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }";
          document.head.appendChild(style);
          window.print();
          setTimeout(() => document.getElementById("__pdf-export-hint")?.remove(), 1000);
        }}
        className="flex items-center gap-2 rounded-xl bg-surface-container-high px-4 py-2.5 text-[0.8125rem] font-medium text-text calm-transition hover:bg-surface-container-highest"
      >
        <svg className="h-4 w-4 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
        Export to PDF
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-on-surface-variant calm-transition hover:text-text"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        Print
      </button>
    </div>
  );
}
