"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 12_000;

/**
 * Renders nothing — keeps an already-open coach conversation page (the
 * claim banner, Join/Release/Pass/Complete buttons, assigned-coach label)
 * in sync with changes made elsewhere: another coach claiming or passing
 * the conversation, a customer's reply auto-reopening a completed thread,
 * etc. Realtime is the fast path; a periodic router.refresh() underneath
 * is a fallback so this never depends on Realtime alone to stay in sync.
 */
export function ConversationLiveWatcher({ conversationId }: { conversationId: string }) {
  const router = useRouter();

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    try {
      supabase = createClient();
      channel = supabase
        .channel(`conversation-watch:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "chat_conversations",
            filter: `id=eq.${conversationId}`,
          },
          () => router.refresh(),
        )
        .subscribe();
    } catch (err) {
      console.error("ConversationLiveWatcher: failed to set up realtime subscription", err);
    }

    const poll = setInterval(() => router.refresh(), POLL_MS);

    return () => {
      clearInterval(poll);
      if (channel) {
        try {
          supabase!.removeChannel(channel);
        } catch {
          // best-effort cleanup
        }
      }
    };
  }, [conversationId, router]);

  return null;
}
