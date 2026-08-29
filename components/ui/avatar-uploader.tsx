"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/toast-provider";

type ActionResult = { ok: true } | { ok: false; error: string };

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AvatarUploader({
  name,
  avatarUrl,
  size = "lg",
  targetUserId,
  uploadAction,
  disabled = false,
}: {
  name: string;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg";
  /** Set when an admin is updating someone else's photo; omitted for self-service. */
  targetUserId?: string;
  uploadAction: (formData: FormData) => Promise<ActionResult>;
  disabled?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);

  function submit(fd: FormData, isRemove: boolean) {
    if (targetUserId) fd.set("id", targetUserId);
    startTransition(async () => {
      const result = await uploadAction(fd);
      setPreview(null);
      if (result.ok) {
        toast(isRemove ? "Photo removed" : "Photo updated", "success");
        router.refresh();
      } else {
        toast(result.error, "error");
      }
    });
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.set("avatar", file);
    submit(fd, false);
    e.target.value = "";
  }

  function onRemove() {
    const fd = new FormData();
    fd.set("remove", "true");
    submit(fd, true);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <Avatar name={name} size={size} avatarUrl={preview ?? avatarUrl} />
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => inputRef.current?.click()}
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted shadow-sm calm-transition hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Change photo"
          title="Change photo"
        >
          <CameraIcon className="h-3.5 w-3.5" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onFileChange}
          disabled={disabled || pending}
        />
      </div>
      <div className="flex flex-col gap-1 text-[0.8125rem]">
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => inputRef.current?.click()}
          className="w-fit font-semibold text-text calm-transition hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
        </button>
        {avatarUrl ? (
          <button
            type="button"
            disabled={disabled || pending}
            onClick={onRemove}
            className="w-fit text-muted calm-transition hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove photo
          </button>
        ) : null}
      </div>
    </div>
  );
}
