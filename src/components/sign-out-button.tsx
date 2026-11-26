"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ locale, label }: { locale: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm text-muted hover:text-ink disabled:opacity-50"
      onClick={() =>
        start(async () => {
          await authClient.signOut();
          router.push(`/${locale}`);
          router.refresh();
        })
      }
    >
      {label}
    </button>
  );
}
