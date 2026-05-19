"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  accept?: string;
  disabled?: boolean;
  file: File | null;
  onFileChange: (file: File | null) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  hint?: string;
};

export function CsvFileDropzone({
  accept = ".csv",
  disabled = false,
  file,
  onFileChange,
  inputRef: externalRef,
  hint = "CSV files only",
}: Props) {
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? internalRef;
  const [dragging, setDragging] = useState(false);

  const pickFile = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled, inputRef]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const next = files?.[0] ?? null;
      if (!next) return;
      if (!next.name.toLowerCase().endsWith(".csv")) return;
      onFileChange(next);
    },
    [onFileChange],
  );

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pickFile();
          }
        }}
        onClick={pickFile}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center calm-transition ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : dragging
              ? "border-[var(--accent)] bg-[var(--accent)]/5"
              : "border-[var(--outline-variant)] bg-[var(--surface-container-low)] hover:border-[var(--on-surface-muted)]"
        }`}
      >
        <svg
          className="mb-3 h-10 w-10 text-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path
            d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v9m-4-4 4-4 4 4" />
        </svg>
        <p className="text-sm font-semibold text-text">
          {file ? file.name : "Click to upload or drag and drop"}
        </p>
        {file ? (
          <p className="mt-1 text-xs text-muted">
            {(file.size / 1024).toFixed(1)} KB · Click or drop to replace
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted">{hint}</p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
      {file ? (
        <button
          type="button"
          className="link-accent text-xs font-medium"
          onClick={(e) => {
            e.stopPropagation();
            onFileChange(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
        >
          Remove file
        </button>
      ) : null}
    </div>
  );
}
