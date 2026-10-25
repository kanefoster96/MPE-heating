"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChatPresence } from "@/lib/chat";

/**
 * Inbox-row companion to ChatThread's presence line: a read-only listener
 * on the same per-conversation presence channel, so the coach inbox shows
 * "Marshal is in this chat" / "Jane typing…" next to a row before anyone
 * opens it — the whole point being that two coaches don't open the same
 * conversation and both start answering. Listens only; never tracks, so
 * glancing at the inbox doesn't make you "present" in every chat.
 */
export function ConversationPresenceBadge({
  conversationId,
  viewerId,
}: {
  conversationId: string;
  viewerId: string;
}) {
  const [others, setOthers] = useState<ChatPresence[]>([]);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    try {
      supabase = createClient();
      channel = supabase.channel(`presence:${conversationId}`);
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<ChatPresence>();
          setOthers(
            Object.entries(state)
              .filter(([key]) => !key.startsWith(`${viewerId}:`))
              .flatMap(([, entries]) => entries)
              .map((entry) => ({ role: entry.role, name: entry.name, typing: entry.typing })),
          );
        })
        .subscribe();
    } catch {
      return;
    }

    return () => {
      try {
        supabase.removeChannel(channel!);
      } catch {
        // best-effort cleanup
      }
    };
  }, [conversationId, viewerId]);

  if (others.length === 0) return null;

  // A coach in the chat is the thing worth flagging loudest; the member
  // being there (or typing) is useful context but not a "don't collide" cue.
  const coaches = [...new Set(others.filter((p) => p.role === "coach").map((p) => p.name))];
  const memberTyping = others.some((p) => p.role === "member" && p.typing);
  const coachTyping = others.some((p) => p.role === "coach" && p.typing);

  const label =
    coaches.length > 0
      ? `${coaches.join(", ")} ${coachTyping ? "typing…" : "in this chat"}`
      : memberTyping
        ? "Typing…"
        : "In the chat now";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        coaches.length > 0 ? "bg-accent/15 text-accent" : "bg-success/15 text-success"
      }`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-flash" />
      {label}
    </span>
  );
}
