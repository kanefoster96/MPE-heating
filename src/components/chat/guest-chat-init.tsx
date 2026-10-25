"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startAnonymousSession } from "@/app/messages/actions";

export function GuestChatInit() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    startAnonymousSession().then((result) => {
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }, [router]);

  if (error) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-danger/30 bg-danger/10 p-6 text-sm text-danger">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => {
            started.current = false;
            setError(null);
            startAnonymousSession().then((result) => {
              if (result.success) {
                router.refresh();
              } else {
                setError(result.error);
              }
            });
          }}
          className="self-start rounded-full border border-danger/30 px-4 py-2 text-sm font-medium text-danger transition-opacity hover:opacity-80 active:opacity-60"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
      <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
      Connecting…
    </div>
  );
}
