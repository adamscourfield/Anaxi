"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import styles from "../../login/login.module.css";

export function InviteForm({ token, fullName, email, schoolName }: {
  token: string; fullName: string; email: string; schoolName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/invite/accept", { method: "POST", body: form });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Unable to accept your invitation. Please try again.");
        setPending(false);
        return;
      }
      router.push("/login?invited=1");
    } catch {
      setError("Unable to accept your invitation. Please try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className={styles.inviteIdentity}>
        <p className={styles.successTitle}>{schoolName}</p>
        <p className={styles.label}>{fullName}</p>
        <p className={styles.help}>{email}</p>
      </div>
      <div className="space-y-2">
        <label className={styles.label} htmlFor="password">Create password</label>
        <input id="password" name="password" type="password" required minLength={8}
          autoComplete="new-password" placeholder="At least 8 characters"
          className={styles.field} aria-describedby="password-hint" />
        <p id="password-hint" className={styles.help}>Use at least 8 characters. A mix of letters and numbers makes it stronger.</p>
      </div>
      <input type="hidden" name="token" value={token} />
      {error && <p className={styles.error} role="alert">{error}</p>}
      <Button type="submit" disabled={pending} aria-busy={pending} className={styles.button}>
        {pending ? "Accepting…" : "Accept invitation"}
      </Button>
    </form>
  );
}
