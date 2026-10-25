"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function ChatGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-colors group-active:fill-current"
        d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2V6Z"
      />
    </svg>
  );
}

type MessageInsertPayload = { new: { sender_is_coach: boolean } };

export function ChatBadge({
  href,
  initialCount,
  mode,
  conversationId,
  onClick,
}: {
  href: string;
  initialCount: number;
  mode: "member" | "coach";
  conversationId?: string;
  onClick?: () => void;
}) {
  const [count, setCount] = useState(initialCount);
  // The nav renders a desktop AND a mobile ChatBadge simultaneously (CSS
  // just hides whichever doesn't match the viewport), and Supabase's
  // browser client is a singleton that dedupes channels by topic name —
  // without a per-instance suffix, the second instance's `.channel()` call
  // returns the first instance's already-subscribed channel and its `.on()`
  // call throws. useId() is stable per mount and guarantees distinct topics.
  const instanceId = useId();

  useEffect(() => {
    // A brand-new visitor with no conversation yet has nothing to watch —
    // RLS would block an unfiltered subscription for them anyway (no
    // session), so skip opening a channel that can never receive anything.
    if (mode === "member" && !conversationId) return;

    // The badge is a nice-to-have, not core functionality — any failure
    // setting up the live connection (client creation, channel setup) must
    // never take the rest of the page down with it, so this is defensive
    // on purpose rather than letting it throw during render/mount.
    let supabase: ReturnType<typeof createClient>;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    try {
      supabase = createClient();

      const handleInsert = (payload: MessageInsertPayload) => {
        const relevant =
          mode === "member" ? payload.new.sender_is_coach : !payload.new.sender_is_coach;
        if (relevant) setCount((c) => c + 1);
      };

      channel =
        mode === "member"
          ? supabase
              .channel(`chat-badge:member:${conversationId}:${instanceId}`)
              .on(
                "postgres_changes",
                {
                  event: "INSERT",
                  schema: "public",
                  table: "chat_messages",
                  filter: `conversation_id=eq.${conversationId}`,
                },
                handleInsert,
              )
              .subscribe()
          : supabase
              .channel(`chat-badge:coach:${instanceId}`)
              .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "chat_messages" },
                handleInsert,
              )
              .subscribe();
    } catch (err) {
      console.error("ChatBadge: failed to set up realtime subscription", err);
      return;
    }

    return () => {
      try {
        supabase.removeChannel(channel!);
      } catch {
        // best-effort cleanup
      }
    };
  }, [mode, conversationId, instanceId]);

  useEffect(() => {
    // Separate channel from the chat-message one above — a broadcast
    // notification is a different table and, unlike a chat message, has no
    // "who sent it" filtering to apply (RLS already scopes delivery to
    // coaches and active members, so any INSERT this client receives at
    // all is one it's meant to see).
    let supabase: ReturnType<typeof createClient>;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    try {
      supabase = createClient();
      channel = supabase
        .channel(`chat-badge:notifications:${mode}:${instanceId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications" },
          () => setCount((c) => c + 1),
        )
        .subscribe();
    } catch (err) {
      console.error("ChatBadge: failed to set up notifications subscription", err);
      return;
    }

    return () => {
      try {
        supabase.removeChannel(channel!);
      } catch {
        // best-effort cleanup
      }
    };
  }, [mode, instanceId]);

  useEffect(() => {
    // Staff only: a new booking enquiry adds one, and it comes off again
    // once someone moves it on from "new" (MPE's take on Kanvas Academy's
    // pending-requests badge), so it reads "how many jobs are waiting".
    if (mode !== "coach") return;

    let supabase: ReturnType<typeof createClient>;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    try {
      supabase = createClient();
      channel = supabase
        .channel(`chat-badge:enquiries:${instanceId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "enquiries" },
          (payload: { new: { status: string } }) => {
            if (payload.new.status === "new") setCount((c) => c + 1);
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "enquiries" },
          (payload: { new: { status: string }; old: { status?: string } }) => {
            if (payload.old.status === "new" && payload.new.status !== "new") setCount((c) => Math.max(0, c - 1));
          },
        )
        .subscribe();
    } catch (err) {
      console.error("ChatBadge: failed to set up enquiries subscription", err);
      return;
    }

    return () => {
      try {
        supabase.removeChannel(channel!);
      } catch {
        // best-effort cleanup
      }
    };
  }, [mode, instanceId]);

  return (
    <Link
      href={href}
      aria-label="Messages"
      onClick={onClick}
      className="group relative text-sm text-muted transition-colors hover:text-foreground active:text-foreground"
    >
      <ChatGlyph />
      {count > 0 && (
        <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-success text-[10px] font-medium text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
