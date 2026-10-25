"use client";

import { useState } from "react";
import { ChatThread } from "@/components/chat/chat-thread";
import type { ChatMessage, SendMessageInput } from "@/lib/chat";
import type { SaveDetailsResult } from "@/lib/chat-welcome";
import { detailsAskFor, isAppPrompt } from "@/lib/chat-welcome-copy";

type SendResult = { success: true } | { success: false; error: string };

/**
 * The customer's side of the live chat: Kanvas Academy's ChatThread, plus
 * MPE's two inline cards — the details form under "what's your email
 * address?", and the app buttons under the app suggestion
 * (lib/chat-welcome.ts). They hang off the messages themselves, so they
 * appear the moment the message arrives, live, with no reload.
 */
export function CustomerChat(props: {
  conversationId: string;
  initialMessages: ChatMessage[];
  viewerId: string;
  presenceName: string;
  hasEmail: boolean;
  hasMobile: boolean;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
  sendAction: (input: SendMessageInput) => Promise<SendResult>;
  markReadAction: () => Promise<void>;
  getAttachmentUrlAction: (path: string) => Promise<string | null>;
  fetchNewMessagesAction: (conversationId: string, afterIso: string) => Promise<ChatMessage[]>;
  heartbeatAction: () => Promise<void>;
  saveDetailsAction: (input: { email?: string; mobile?: string }) => Promise<SaveDetailsResult>;
}) {
  const [saved, setSaved] = useState(false);

  const renderExtra = (message: ChatMessage) => {
    if (!message.senderIsCoach || message.senderId) return null;
    const ask = detailsAskFor(message.body);
    if (ask) {
      const wantEmail = ask.email && !props.hasEmail;
      const wantMobile = ask.mobile && !props.hasMobile;
      if (saved || (!wantEmail && !wantMobile)) return null;
      return <DetailsCard wantEmail={wantEmail} wantMobile={wantMobile} onSave={props.saveDetailsAction} onSaved={() => setSaved(true)} />;
    }
    if (isAppPrompt(message.body) && (props.appStoreUrl || props.playStoreUrl)) {
      return <AppCard appStoreUrl={props.appStoreUrl} playStoreUrl={props.playStoreUrl} />;
    }
    return null;
  };

  return (
    <ChatThread
      conversationId={props.conversationId}
      initialMessages={props.initialMessages}
      viewerId={props.viewerId}
      presence={{ role: "member", name: props.presenceName }}
      sendAction={props.sendAction}
      markReadAction={props.markReadAction}
      getAttachmentUrlAction={props.getAttachmentUrlAction}
      fetchNewMessagesAction={props.fetchNewMessagesAction}
      heartbeatAction={props.heartbeatAction}
      emptyLabel="Say hello and an engineer will get back to you here."
      renderExtra={renderExtra}
      flush
    />
  );
}

const INPUT =
  "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-base text-foreground outline-none focus:border-foreground/40 sm:text-sm";

function DetailsCard({
  wantEmail,
  wantMobile,
  onSave,
  onSaved,
}: {
  wantEmail: boolean;
  wantMobile: boolean;
  onSave: (input: { email?: string; mobile?: string }) => Promise<SaveDetailsResult>;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const result = await onSave({
          ...(wantEmail ? { email } : {}),
          ...(wantMobile ? { mobile } : {}),
        });
        setBusy(false);
        if (result.success) onSaved();
        else setError(result.error);
      }}
      className="mt-1 flex w-full max-w-xs flex-col gap-2 rounded-2xl border border-border bg-surface p-3"
      data-details-card
    >
      {wantEmail && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Email address
          <input type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
        </label>
      )}
      {wantMobile && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Mobile number
          <input type="tel" inputMode="tel" autoComplete="tel" required value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="07123 456789" className={INPUT} />
        </label>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Send my details"}
      </button>
    </form>
  );
}

function AppCard({ appStoreUrl, playStoreUrl }: { appStoreUrl: string | null; playStoreUrl: string | null }) {
  const button =
    "inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:border-foreground/40";
  return (
    <div className="mt-1 flex flex-wrap gap-2" data-app-card>
      {appStoreUrl && (
        <a href={appStoreUrl} target="_blank" rel="noopener noreferrer" className={button}>
          App Store
        </a>
      )}
      {playStoreUrl && (
        <a href={playStoreUrl} target="_blank" rel="noopener noreferrer" className={button}>
          Google Play
        </a>
      )}
    </div>
  );
}
