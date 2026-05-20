"use client";

import { AdminSectionLink } from "@/components/admin/admin-section-link";

function UploadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="anx-icon-inline" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 3v10M6 7l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AddStaffIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="anx-icon-inline" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 7a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 17v-1a5 5 0 015-5h2a5 5 0 015 5v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 4v4M14 6h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function UserDirectoryHeaderActions({ onAddStaff }: { onAddStaff: () => void }) {
  return (
    <>
      <AdminSectionLink href="/admin?section=users-import" className="anx-btn-pill-ghost calm-transition">
        <UploadIcon />
        Import CSV
      </AdminSectionLink>
      <button type="button" onClick={onAddStaff} className="anx-btn-pill-primary calm-transition">
        <AddStaffIcon />
        Add staff
      </button>
    </>
  );
}
