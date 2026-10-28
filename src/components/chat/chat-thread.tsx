"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AvatarCircle } from "@/components/coach/avatar-circle";
import { ChatBody } from "@/components/chat/chat-body";
import { PaymentRequestCard } from "@/components/chat/payment-request-card";
import type {
  ChatAttachmentType,
  ChatChannel,
  ChatMessage,
  ChatPresence,
  SendMessageInput,
} from "@/lib/chat";
import { CLUB } from "@/lib/club";

type SendResult = { success: true } | { success: false; error: string };

/** How long after the last keystroke "typing…" clears if they stop without sending. */
const TYPING_IDLE_MS = 3000;
/** Member-side "I'm in the chat" heartbeat cadence — see heartbeatMemberActivity. */
const HEARTBEAT_MS = 30 * 1000;

/**
 * "Marshal is typing…" / "Jane and Kane are here" — one line summarising
 * everyone else currently in this conversation. Typing wins over merely
 * being present, since it's the more useful thing to know.
 */
function presenceSummary(others: ChatPresence[], viewerRole: ChatPresence["role"]): string | null {
  // Members see none of this: messaging is one-way from their side, so
  // they're never shown whether a coach is in, reading or typing. Coaches
  // see each other and the member, so nobody answers the same person twice.
  if (viewerRole === "member") return null;
  const relevant = others;
  if (relevant.length === 0) return null;

  const uniqueNames = (list: ChatPresence[]) => [...new Set(list.map((p) => p.name))];
  const join = (names: string[]) =>
    names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

  const typing = uniqueNames(relevant.filter((p) => p.typing));
  if (typing.length > 0) return `${join(typing)} ${typing.length === 1 ? "is" : "are"} typing…`;

  const here = uniqueNames(relevant);
  return `${join(here)} ${here.length === 1 ? "is" : "are"} in this chat`;
}

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_is_coach: boolean;
  body: string;
  channel: ChatChannel;
  attachment_path: string | null;
  attachment_type: ChatAttachmentType | null;
  attachment_name: string | null;
  payment_request_id?: string | null;
  created_at: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Built manually (not toLocaleString) so server and client agree regardless
// of ICU/locale differences — same reasoning as student-home's formatter,
// duplicated locally to keep this client bundle free of server-only imports.
function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} · ${hours}:${minutes}`;
}

const DIVIDER_GAP_MS = 5 * 60 * 1000;

// Only show a timestamp divider on the first message and after a gap,
// instead of under every single bubble — matches how most chat apps group
// a back-and-forth into a single labeled block.
function needsDivider(current: ChatMessage, previous: ChatMessage | undefined) {
  if (!previous) return true;
  return (
    new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime() >
    DIVIDER_GAP_MS
  );
}

/**
 * Folds one freshly-arrived message (from Realtime or the polling fallback)
 * into the local list — idempotent by id, so calling it twice for the same
 * message (e.g. Realtime and the poll both surface it) is always safe.
 * A message already present gets patched with any richer fields the new
 * copy carries (resolved attachment URL, resolved coach name/photo) rather
 * than being skipped outright, since Realtime payloads are raw DB rows
 * without those, while the poll's payload has them fully resolved.
 */
function mergeMessage(
  prev: ChatMessage[],
  incoming: ChatMessage,
  viewerId: string,
  pendingRef: React.MutableRefObject<{ tempId: string; body: string }[]>,
): ChatMessage[] {
  const existingIndex = prev.findIndex((m) => m.id === incoming.id);
  if (existingIndex !== -1) {
    const existing = prev[existingIndex];
    const next = [...prev];
    next[existingIndex] = {
      ...existing,
      body: incoming.body,
      attachmentPath: incoming.attachmentPath,
      attachmentType: incoming.attachmentType,
      attachmentName: incoming.attachmentName,
      attachmentUrl: incoming.attachmentUrl ?? existing.attachmentUrl,
      senderName: incoming.senderName ?? existing.senderName,
      senderAvatarUrl: incoming.senderAvatarUrl ?? existing.senderAvatarUrl,
    };
    return next;
  }

  if (incoming.senderId === viewerId && pendingRef.current.length > 0) {
    const [oldest, ...rest] = pendingRef.current;
    const replacedIndex = prev.findIndex((m) => m.id === oldest.tempId);
    if (replacedIndex !== -1) {
      pendingRef.current = rest;
      const replaced = prev[replacedIndex];
      // Carry over the sender's own instant local preview (an object URL)
      // instead of re-fetching a signed URL for something they already
      // have on screen.
      const next = [...prev];
      next[replacedIndex] = {
        ...incoming,
        attachmentUrl: replaced.attachmentUrl ?? incoming.attachmentUrl,
      };
      return next;
    }
  }

  return [...prev, incoming].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop();
  return fromName && fromName !== file.name ? fromName : "bin";
}

function LinkGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path strokeLinecap="round" d="M8.5 11.5a3 3 0 0 0 4.24 0l2.12-2.12a3 3 0 0 0-4.24-4.24l-1 1" />
      <path strokeLinecap="round" d="M11.5 8.5a3 3 0 0 0-4.24 0l-2.12 2.12a3 3 0 0 0 4.24 4.24l1-1" />
    </svg>
  );
}

function SendGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function SparkleGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4" aria-hidden="true">
      <path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6L10 3Z" strokeLinejoin="round" />
      <path d="M15.5 13.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4Z" strokeLinejoin="round" />
    </svg>
  );
}

function PlusGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-5 w-5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function PhotoGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-4 w-4"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.75" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 17 5-5 4 4 3-3 4 4" />
    </svg>
  );
}

function VideoGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-4 w-4"
    >
      <rect x="3" y="6" width="13" height="12" rx="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.5 10.5 4.5-2.7v8.4l-4.5-2.7" />
    </svg>
  );
}

function FileGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
    </svg>
  );
}

function AttachmentContent({
  message,
  resolveUrl,
}: {
  message: ChatMessage;
  resolveUrl: (path: string) => void;
}) {
  useEffect(() => {
    if (message.attachmentPath && message.attachmentUrl === undefined) {
      resolveUrl(message.attachmentPath);
    }
  }, [message.attachmentPath, message.attachmentUrl, resolveUrl]);

  if (!message.attachmentPath || !message.attachmentType) return null;

  if (!message.attachmentUrl) {
    return (
      <div className="flex h-32 w-48 items-center justify-center rounded-lg bg-foreground/5 text-xs text-muted">
        Loading…
      </div>
    );
  }

  if (message.attachmentType === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={message.attachmentUrl}
        alt={message.attachmentName ?? "Attachment"}
        className="max-h-64 max-w-full rounded-lg object-cover"
      />
    );
  }

  if (message.attachmentType === "video") {
    return (
      <video
        src={message.attachmentUrl}
        controls
        className="max-h-64 max-w-full rounded-lg"
      />
    );
  }

  // Voicemails from the phone line (lib/missed-calls.ts) play in place.
  if (message.attachmentName?.startsWith("Voicemail") && message.attachmentName.endsWith(".mp3")) {
    return <audio src={message.attachmentUrl} controls preload="none" className="w-64 max-w-full" />;
  }

  return (
    <a
      href={message.attachmentUrl}
      target="_blank"
      rel="noopener noreferrer"
      download={message.attachmentName ?? undefined}
      className="flex items-center gap-2 rounded-lg bg-foreground/5 px-3 py-2 text-sm underline underline-offset-4"
    >
      <FileGlyph />
      {message.attachmentName ?? "File"}
    </a>
  );
}

export function ChatThread({
  conversationId,
  initialMessages,
  viewerId,
  presence,
  sendAction,
  markReadAction,
  getAttachmentUrlAction,
  fetchNewMessagesAction,
  heartbeatAction,
  emptyLabel = "No messages yet — say hello!",
  locked = false,
  lockedMessage,
  flush = false,
  channelPicker,
  suggestAction,
  staffThread,
  readers: initialReaders,
  loadReaders,
  renderExtra,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  viewerId: string;
  /** Who this viewer is to everyone else in the chat — broadcast over the conversation's presence channel so they can see "X is here / typing". */
  presence: Omit<ChatPresence, "typing">;
  sendAction: (input: SendMessageInput) => Promise<SendResult>;
  markReadAction: () => Promise<void>;
  getAttachmentUrlAction: (path: string) => Promise<string | null>;
  /** Polling fallback alongside the Realtime subscription below — belt and
   * suspenders so replies still arrive live even if a Realtime event is
   * ever missed or Realtime isn't reachable for some reason. */
  fetchNewMessagesAction: (conversationId: string, afterIso: string) => Promise<ChatMessage[]>;
  /** Member-only: called every ~30s while the thread is on screen, so a
   * coach reply to someone who's actively watching isn't also emailed to
   * them. Coaches don't need one — nothing is ever sent to a coach. */
  heartbeatAction?: () => Promise<void>;
  emptyLabel?: string;
  /** Hides the composer and shows lockedMessage instead — a completed
   * conversation on the coach side. Member-facing usage never sets this. */
  locked?: boolean;
  lockedMessage?: string;
  /** Runs edge-to-edge on phones (no side border or rounding) and boxed on larger screens — the coach conversation page. */
  flush?: boolean;
  /** Coach-only: lets the composer send as email/text instead of in-app chat. A member never gets this choice. */
  channelPicker?: {
    phone: string | null;
    /** Text is admin-only — texts cost per message. */
    smsAllowed: boolean;
    updatePhoneAction: (phone: string) => Promise<{ success: true } | { success: false; error: string }>;
  };
  /** Coach-only: drafts a reply with AI (lib/chat-suggest.ts). Runs on its own when the other person has the last word, and on demand from the ✦ button. */
  suggestAction?: (conversationId: string) => Promise<{ success: true; text: string } | { success: false; error: string }>;
  /**
   * Group chat read receipts (Kanvas Team): each person's avatar sits under
   * the last message they've read. loadReaders refreshes them while open.
   */
  readers?: ThreadReader[];
  loadReaders?: () => Promise<ThreadReader[]>;
  /** A coach-side thread with no family on the other end (Kanvas Team): coach composer, no families' footer. */
  staffThread?: boolean;
  /** Something to show under a message: MPE's details form under the
   * "what's your email?" ask, and the app buttons under the app prompt
   * (src/components/chat/chat-flow-extras.tsx). */
  renderExtra?: (message: ChatMessage) => React.ReactNode;
}) {
  // A customer's chat (staff side): links to MPE's booking forms from the
  // + menu, dropped into the message box (Kanvas Academy shares store
  // items and its trial form the same way).
  const shareItems = !!channelPicker;
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  // A coach typing "free trial" is offered a link to the booking form; ✕
  // turns it down for this message. Cleared once the phrase leaves the draft.
  const isCoachComposer = !!channelPicker || !!suggestAction || !!staffThread;

  const [readers, setReaders] = useState<ThreadReader[]>(initialReaders ?? []);
  useEffect(() => {
    if (!loadReaders) return;
    const id = setInterval(() => {
      loadReaders().then(setReaders).catch(() => {});
    }, 15_000);
    return () => clearInterval(id);
  }, [loadReaders]);
  const [others, setOthers] = useState<ChatPresence[]>([]);
  const presenceChannelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const typingRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Reply the way they last got in touch: a text gets a text back where
  // Text is allowed (MPE doesn't: staff/messages/[id]), anything else live chat.
  const [sendChannel, setSendChannel] = useState<ChatChannel>(() => {
    const lastFromThem = [...initialMessages].reverse().find((m) => !m.senderIsCoach);
    return channelPicker?.smsAllowed && lastFromThem?.channel === "sms" ? "sms" : "chat";
  });
  const [phone, setPhone] = useState(channelPicker?.phone ?? null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  // The member message a suggestion was last drafted (or dismissed) for —
  // a new message from them starts the cycle again, ours doesn't.
  const suggestedForRef = useRef<string | null>(null);
  const pendingRef = useRef<{ tempId: string; body: string }[]>([]);
  const resolvingRef = useRef<Set<string>>(new Set());
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef(messages);

  // The composer grows line by line with what's typed (or a suggested
  // reply dropped in to edit), up to a few lines, then scrolls inside.
  useEffect(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /** A link from the + menu, after whatever's already typed, ready to add to before sending. */
  function addToDraft(text: string) {
    setDraft((current) => (current.trim() ? `${current.trimEnd()} ${text}` : text));
    requestAnimationFrame(() => {
      const el = draftRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }
  const bottomRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    markReadAction();
    // Only meant to fire once, on mount — re-running on every markReadAction
    // identity change (a new function reference each render) would spam it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Live updates are an enhancement on top of the already-loaded message
    // list, not something the page depends on to render — any failure
    // setting this up must never crash the surrounding page.
    let supabase: ReturnType<typeof createClient>;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    try {
      supabase = createClient();
      channel = supabase
        .channel(`chat_messages:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as MessageRow;
            const incoming: ChatMessage = {
              id: row.id,
              conversationId: row.conversation_id,
              senderId: row.sender_id,
              senderIsCoach: row.sender_is_coach,
              body: row.body,
              channel: row.channel,
              attachmentPath: row.attachment_path,
              attachmentType: row.attachment_type,
              attachmentName: row.attachment_name,
              paymentRequestId: row.payment_request_id ?? null,
              createdAt: row.created_at,
            };

            setMessages((prev) => mergeMessage(prev, incoming, viewerId, pendingRef));

            if (incoming.senderId !== viewerId) {
              markReadAction();
            }
          },
        )
        .subscribe();
    } catch (err) {
      console.error("ChatThread: failed to set up realtime subscription", err);
      return;
    }

    return () => {
      try {
        supabase.removeChannel(channel!);
      } catch {
        // best-effort cleanup
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, viewerId]);

  useEffect(() => {
    let cancelled = false;

    const poll = setInterval(async () => {
      const lastReal = [...messagesRef.current].reverse().find((m) => !m.id.startsWith("temp-"));
      const afterIso = lastReal?.createdAt ?? new Date(0).toISOString();

      try {
        const fresh = await fetchNewMessagesAction(conversationId, afterIso);
        if (cancelled || fresh.length === 0) return;

        setMessages((prev) =>
          fresh.reduce((acc, incoming) => mergeMessage(acc, incoming, viewerId, pendingRef), prev),
        );

        if (fresh.some((m) => m.senderId !== viewerId)) markReadAction();
      } catch (err) {
        console.error("ChatThread: message poll failed", err);
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, viewerId]);

  // Presence: everyone with this conversation open shares one Realtime
  // presence channel and tracks {role, name, typing}. Nothing is persisted
  // — leave the page and you vanish from it. Keyed per tab (not per user)
  // so two tabs from the same person don't fight over one presence entry;
  // the summary dedupes by name so they still read as one person.
  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    try {
      supabase = createClient();
      channel = supabase.channel(`presence:${conversationId}`, {
        config: { presence: { key: `${viewerId}:${crypto.randomUUID()}` } },
      });
      presenceChannelRef.current = channel;

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<ChatPresence>();
          const everyoneElse = Object.entries(state)
            .filter(([key]) => !key.startsWith(`${viewerId}:`))
            .flatMap(([, entries]) => entries)
            .map((entry) => ({ role: entry.role, name: entry.name, typing: entry.typing }));
          setOthers(everyoneElse);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel!.track({ role: presence.role, name: presence.name, typing: false });
          }
        });
    } catch (err) {
      console.error("ChatThread: failed to set up presence", err);
      return;
    }

    return () => {
      presenceChannelRef.current = null;
      try {
        supabase.removeChannel(channel!);
      } catch {
        // best-effort cleanup
      }
    };
  }, [conversationId, viewerId, presence.role, presence.name]);

  const setTyping = useCallback(
    (typing: boolean) => {
      if (typingRef.current === typing) return;
      typingRef.current = typing;
      presenceChannelRef.current?.track({ role: presence.role, name: presence.name, typing }).catch(() => {
        // presence is cosmetic — never let it surface as an error
      });
    },
    [presence.role, presence.name],
  );

  /** Marks us as typing and re-arms the idle timer that clears it — called on every keystroke. */
  const noteTyping = useCallback(() => {
    setTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => setTyping(false), TYPING_IDLE_MS);
  }, [setTyping]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  // Member-side heartbeat — only while the tab is actually visible, since a
  // chat left open in a background tab isn't "being watched".
  useEffect(() => {
    if (!heartbeatAction) return;

    const beat = () => {
      if (document.visibilityState === "visible") heartbeatAction().catch(() => {});
    };
    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", beat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const presenceLine = presenceSummary(others, presence.role);

  async function resolveAttachmentUrl(path: string) {
    if (resolvingRef.current.has(path)) return;
    resolvingRef.current.add(path);

    const url = await getAttachmentUrlAction(path);

    setMessages((prev) =>
      prev.map((m) => (m.attachmentPath === path ? { ...m, attachmentUrl: url } : m)),
    );
  }

  const requestSuggestion = useCallback(async () => {
    if (!suggestAction || suggesting) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const result = await suggestAction(conversationId);
      if (result.success) setSuggestion(result.text);
      else setSuggestError(result.error);
    } catch {
      setSuggestError("Couldn't draft a reply right now.");
    } finally {
      setSuggesting(false);
    }
  }, [suggestAction, suggesting, conversationId]);

  // When the other person has the last word, offer to draft (once per new
  // message from them) — the coach taps to run it, so nothing is spent on
  // threads they were going to answer themselves.
  const [offer, setOffer] = useState(false);
  useEffect(() => {
    if (!suggestAction || locked || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.senderIsCoach || last.senderId === viewerId || last.id.startsWith("temp-")) return;
    if (suggestedForRef.current === last.id) return;
    suggestedForRef.current = last.id;
    setSuggestion(null);
    setOffer(true);
  }, [messages, locked, suggestAction, viewerId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendText(draft.trim());
  }

  /** Sends a plain text message — the composer's submit, or a suggested reply sent as-is. */
  async function sendText(rawBody: string) {
    if (!rawBody || sending) return;
    setSuggestion(null);

    const body = rawBody;

    setSending(true);
    setError(null);

    const tempId = `temp-${crypto.randomUUID()}`;
    pendingRef.current.push({ tempId, body });
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        conversationId,
        senderId: viewerId,
        senderIsCoach: false,
        body,
        channel: sendChannel,
        attachmentPath: null,
        attachmentType: null,
        attachmentName: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    setDraft("");
    setTyping(false);

    const result = await sendAction(channelPicker ? { body, channel: sendChannel } : { body });
    setSending(false);

    if (!result.success) {
      setError(result.error);
      pendingRef.current = pendingRef.current.filter((p) => p.tempId !== tempId);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(rawBody);
    }
  }

  async function handleAttach(file: File, type: ChatAttachmentType) {
    setAttachMenuOpen(false);
    setError(null);

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("That file is too large — please keep it under 25MB.");
      return;
    }

    const caption = draft.trim();
    const path = `${conversationId}/${crypto.randomUUID()}.${extensionFor(file)}`;
    const localPreviewUrl = type === "image" ? URL.createObjectURL(file) : undefined;

    const tempId = `temp-${crypto.randomUUID()}`;
    pendingRef.current.push({ tempId, body: caption });
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        conversationId,
        senderId: viewerId,
        senderIsCoach: false,
        body: caption,
        // Attachments always go through in-app chat regardless of the
        // channel picker — SMS/MMS and email attachments aren't supported.
        channel: "chat",
        attachmentPath: path,
        attachmentType: type,
        attachmentName: file.name,
        attachmentUrl: localPreviewUrl,
        createdAt: new Date().toISOString(),
      },
    ]);
    setDraft("");
    setSending(true);

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("chat-attachments")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      setSending(false);
      setError("Could not upload that file — please try again.");
      pendingRef.current = pendingRef.current.filter((p) => p.tempId !== tempId);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return;
    }

    const result = await sendAction({
      body: caption,
      attachmentPath: path,
      attachmentType: type,
      attachmentName: file.name,
    });
    setSending(false);

    if (!result.success) {
      setError(result.error);
      pendingRef.current = pendingRef.current.filter((p) => p.tempId !== tempId);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  }

  // Each reader goes under the last message they'd read: the latest one
  // sent at or before they last opened the chat, or their own latest post.
  const readersByMessage = new Map<string, ThreadReader[]>();
  for (const r of readers) {
    let at = r.lastReadAt ?? "";
    for (const m of messages) if (m.senderId === r.userId && m.createdAt > at) at = m.createdAt;
    if (!at) continue;
    let target: string | null = null;
    for (const m of messages) if (m.createdAt <= at) target = m.id;
    if (target) readersByMessage.set(target, [...(readersByMessage.get(target) ?? []), r]);
  }

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col bg-surface ${
        flush ? "border-t border-border sm:rounded-2xl sm:border" : "rounded-2xl border border-border"
      }`}
    >
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted">{emptyLabel}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {messages.map((message, i) => {
              const isMine = message.senderId === viewerId;
              const hasDivider = needsDivider(message, messages[i - 1]);
              // A coach message from someone else gets a name + photo right
              // on the bubble, like a normal chat app — only on the first
              // message of a run from that sender, not on every single one.
              const showSenderLabel =
                !isMine &&
                message.senderIsCoach &&
                (hasDivider || i === 0 || messages[i - 1].senderId !== message.senderId);

              return (
                <div key={message.id}>
                  {hasDivider && (
                    <p className="my-3 text-center text-[11px] text-muted">
                      {formatMessageTime(message.createdAt)}
                    </p>
                  )}
                  <div
                    className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    {!isMine && message.senderIsCoach && (
                      <div className="h-7 w-7 shrink-0">
                        {showSenderLabel && (
                          <AvatarCircle
                            name={message.senderName ?? CLUB.shortName}
                            avatarUrl={message.senderAvatarUrl}
                            size="sm"
                          />
                        )}
                      </div>
                    )}
                    <div className="flex max-w-[80%] flex-col gap-1">
                      {showSenderLabel && (
                        <span className="px-1 text-xs font-medium text-muted">
                          {message.senderName ?? CLUB.shortName}
                        </span>
                      )}
                      <div
                        className={`flex flex-col gap-2 rounded-[1.375rem] px-4 py-2.5 text-sm ${
                          isMine
                            ? "bg-accent text-accent-foreground"
                            : "border border-border bg-background text-foreground"
                        } ${message.attachmentPath ? "p-2" : ""}`}
                      >
                        {message.attachmentPath && (
                          <AttachmentContent
                            message={message}
                            resolveUrl={resolveAttachmentUrl}
                          />
                        )}
                        {message.paymentRequestId ? (
                          <PaymentRequestCard
                            id={message.paymentRequestId}
                            fallback={<ChatBody body={message.body} linkify={message.senderIsCoach} />}
                          />
                        ) : (
                          message.body && (
                            <ChatBody
                              body={message.body}
                              linkify={message.senderIsCoach}
                              className={message.attachmentPath ? "px-2 pb-1" : ""}
                            />
                          )
                        )}
                      </div>
                      {message.channel !== "chat" && (
                        <span className={`px-1 text-[11px] text-muted ${isMine ? "text-right" : ""}`}>
                          via {message.channel === "sms" ? "text" : "email"}
                        </span>
                      )}
                      {renderExtra?.(message)}
                    </div>
                  </div>
                  {(readersByMessage.get(message.id) ?? []).length > 0 && (
                    <div className="mt-1 flex justify-end gap-0.5" aria-label="Seen by">
                      {readersByMessage.get(message.id)!.map((r) => (
                        <ReaderDot key={r.userId} reader={r} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {presenceLine && (
        <p
          aria-live="polite"
          className="flex items-center gap-1.5 border-t border-border px-4 py-1.5 text-xs text-muted"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-flash" />
          {presenceLine}
        </p>
      )}

      {!locked && channelPicker?.smsAllowed && sendChannel === "sms" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted">
          {editingPhone ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPhoneError(null);
                const result = await channelPicker.updatePhoneAction(phoneDraft);
                if (!result.success) {
                  setPhoneError(result.error);
                  return;
                }
                setPhone(phoneDraft);
                setEditingPhone(false);
              }}
              className="flex flex-1 items-center gap-2"
            >
              <input
                value={phoneDraft}
                onChange={(e) => setPhoneDraft(e.target.value)}
                placeholder="07123 456789"
                autoFocus
                className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-foreground/40"
              />
              <button type="submit" className="shrink-0 text-accent underline underline-offset-2">
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingPhone(false)}
                className="shrink-0 text-muted underline underline-offset-2"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <span>{phone ? `Text number: ${phone}` : "No phone number on file"}</span>
              <button
                type="button"
                onClick={() => {
                  setPhoneError(null);
                  setPhoneDraft(phone ?? "");
                  setEditingPhone(true);
                }}
                className="shrink-0 text-accent underline underline-offset-2"
              >
                {phone ? "Edit" : "Add"}
              </button>
            </>
          )}
          {phoneError && <span className="w-full text-danger">{phoneError}</span>}
        </div>
      )}

      {!locked && suggestAction && offer && !suggestion && !suggesting && !suggestError && (
        <div className="flex items-center justify-between gap-3 border-t border-border bg-background/60 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-muted">
            <SparkleGlyph />
            Want a suggested reply?
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOffer(false)}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground"
            >
              No thanks
            </button>
            <button
              type="button"
              onClick={() => {
                setOffer(false);
                void requestSuggestion();
              }}
              className="rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
            >
              Draft one
            </button>
          </div>
        </div>
      )}

      {!locked && suggestAction && (suggestion || suggesting || suggestError) && (
        <div className="border-t border-border bg-background/60 px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            <SparkleGlyph />
            {suggesting ? "Drafting a reply…" : "Suggested reply"}
          </div>
          {suggestError ? (
            <p className="mt-1 text-xs text-danger">{suggestError}</p>
          ) : suggestion ? (
            <div className="mt-2 flex items-start gap-2">
              <p className="min-w-0 flex-1 whitespace-pre-wrap rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-sm">
                {suggestion}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Dismiss suggestion"
                  title="Dismiss"
                  onClick={() => setSuggestion(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-foreground/40 hover:text-foreground"
                >
                  ✕
                </button>
                <button
                  type="button"
                  aria-label="Edit suggestion"
                  title="Edit before sending"
                  onClick={() => {
                    setDraft(suggestion);
                    setSuggestion(null);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-foreground/40 hover:text-foreground"
                >
                  ✎
                </button>
                <button
                  type="button"
                  aria-label="Send suggestion"
                  title="Send as-is"
                  disabled={sending || (sendChannel === "sms" && !phone)}
                  onClick={() => sendText(suggestion)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  ✓
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {locked ? (
        <p className="border-t border-border px-4 py-3 text-center text-sm text-muted">
          {lockedMessage ?? "This conversation is being handled by someone else."}
        </p>
      ) : (
      <>
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-border p-3"
      >
        <div className="relative">
          <button
            type="button"
            aria-label="Attach a file"
            onClick={() => setAttachMenuOpen((v) => !v)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-foreground/40 active:bg-foreground/10 hover:text-foreground active:text-foreground"
          >
            <PlusGlyph />
          </button>

          {attachMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Close attach menu"
                onClick={() => setAttachMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div className="absolute bottom-12 left-0 z-20 flex w-40 flex-col gap-1 rounded-2xl border border-border bg-surface p-2 shadow-lg">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-background active:bg-background/70"
                >
                  <PhotoGlyph />
                  Photo
                </button>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-background active:bg-background/70"
                >
                  <VideoGlyph />
                  Video
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-background active:bg-background/70"
                >
                  <FileGlyph />
                  File
                </button>
                {shareItems && (
                  <a
                    href={`/staff/payments/new?conversation=${conversationId}`}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-background active:bg-background/70"
                  >
                    <LinkGlyph />
                    Take payment
                  </a>
                )}
                {shareItems &&
                  (
                    [
                      ["Call-out form", "/emergency"],
                      ["Boiler quote form", "/book/new-boiler"],
                      ["Service form", "/book/service"],
                      ["Plan form", "/book/plan"],
                    ] as const
                  ).map(([label, path]) => (
                    <button
                      key={path}
                      type="button"
                      onClick={() => {
                        setAttachMenuOpen(false);
                        addToDraft(`[${label.replace(" form", "")}](https://${CLUB.domain}${path})`);
                      }}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-background active:bg-background/70"
                    >
                      <LinkGlyph />
                      {label}
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) handleAttach(file, "image");
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) handleAttach(file, "video");
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) handleAttach(file, "file");
          }}
        />

        {channelPicker && (
          <select
            value={sendChannel}
            onChange={(e) => setSendChannel(e.target.value as ChatChannel)}
            aria-label="Send via"
            className="shrink-0 rounded-full border border-border bg-background px-2 py-2 text-xs outline-none focus:border-foreground/40"
          >
            <option value="chat">Live chat</option>
            <option value="email">Email</option>
            {channelPicker.smsAllowed && <option value="sms">Text</option>}
          </select>
        )}

        {suggestAction && (
          <button
            type="button"
            aria-label="Suggest a reply"
            title="Suggest a reply"
            disabled={suggesting}
            onClick={() => {
              setOffer(false);
              void requestSuggestion();
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-foreground/40 hover:text-foreground active:bg-foreground/10 disabled:opacity-50"
          >
            <SparkleGlyph />
          </button>
        )}

        <textarea
          ref={draftRef}
          value={draft}
          rows={1}
          onChange={(e) => {
            setDraft(e.target.value);
            if (e.target.value.trim()) noteTyping();
            else setTyping(false);
          }}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter makes a new line — like every chat app.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={sendChannel === "sms" && !phone ? "Add a phone number above first…" : "Type a message…"}
          className="max-h-40 min-w-0 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm leading-5 outline-none focus:border-foreground/40"
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={sending || !draft.trim() || (sendChannel === "sms" && !phone)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity hover:opacity-90 active:opacity-75 disabled:opacity-50"
        >
          <SendGlyph />
        </button>
      </form>
      {!isCoachComposer && (
        <p className="px-4 pb-2 text-center text-[11px] text-muted">
          Please keep it respectful. By messaging us you agree to our{" "}
          <a href="/policies" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
            codes of conduct
          </a>
          .
        </p>
      )}
      </>
      )}

      {error && (
        <p className="border-t border-danger/30 bg-danger/10 px-4 py-2 text-center text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export type ThreadReader = { userId: string; name: string; avatarUrl: string | null; lastReadAt: string | null };

/** A tiny "seen" avatar under a message. */
function ReaderDot({ reader }: { reader: ThreadReader }) {
  const initial = reader.name.replace(/^Coach\s+/i, "").charAt(0).toUpperCase();
  return reader.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={reader.avatarUrl} alt="" title={`Seen by ${reader.name}`} className="h-4 w-4 rounded-full object-cover" />
  ) : (
    <span
      title={`Seen by ${reader.name}`}
      className="flex h-4 w-4 items-center justify-center rounded-full bg-foreground/15 text-[9px] font-semibold text-foreground"
    >
      {initial}
    </span>
  );
}
