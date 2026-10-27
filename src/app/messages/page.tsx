import type { Metadata } from "next";
import { CustomerChat } from "@/components/chat/customer-chat";
import { GuestChatInit } from "@/components/chat/guest-chat-init";
import { MessagesScreen } from "@/components/chat/messages-screen";
import { ContactOptions } from "@/components/ContactOptions";
import { adoptCustomerConversation } from "@/lib/account-claim";
import { getOrCreateConversation, getConversationMessages, isGuestUser } from "@/lib/chat-db";
import { appLinks } from "@/lib/chat-welcome-copy";
import { ensureWelcome } from "@/lib/chat-welcome";
import { CHAT_ON } from "@/lib/chat-on";
import { resolveDisplayName } from "@/lib/display-name";
import { CLUB } from "@/lib/club";
import { sendSignInLink } from "@/app/account/actions";
import {
  sendMemberMessage,
  markConversationReadAsMember,
  getAttachmentUrl,
  getNewMessages,
  heartbeatMemberActivity,
  saveChatDetails,
} from "./actions";

export const metadata: Metadata = {
  title: "Live chat",
  robots: { index: false, follow: false },
};

// The live chat (Kanvas Academy's, with MPE's welcome, details ask and app
// suggestion — lib/chat-welcome.ts). A visitor with no account gets an
// anonymous session straight away, so they can type with no form first.
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ continue?: string; sent?: string; error?: string }> }) {
  const params = await searchParams;
  if (!CHAT_ON) {
    return (
      <MessagesScreen title={`Chat with ${CLUB.name}`}>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <h2 className="text-xl font-semibold tracking-tight">Live chat is coming soon</h2>
          <p className="mt-2 max-w-sm text-muted">In the meantime, our engineers are a call or an email away.</p>
          <ContactOptions className="mt-6" />
        </div>
      </MessagesScreen>
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // From a reply email, on a device that isn't the one they chatted on: their conversation's
  // under the email they gave, so a sign-in link to it opens it, history and all.
  if (!user && params.continue) {
    return (
      <MessagesScreen title={`Chat with ${CLUB.name}`} subtitle="Live chat">
        <div className="flex-1 overflow-y-auto px-6 py-8">
          {params.sent ? (
            <div className="max-w-sm">
              <h2 className="text-xl font-semibold tracking-tight">Check your email</h2>
              <p className="mt-2 text-muted">
                We&rsquo;ve sent a link to <strong className="text-foreground">{params.sent}</strong>. Open it on this device to see your conversation.
              </p>
              <a href="/messages?continue=1" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
                Use a different email
              </a>
            </div>
          ) : (
            <form action={sendSignInLink} className="flex max-w-sm flex-col gap-4">
              <h2 className="text-xl font-semibold tracking-tight">See your conversation</h2>
              <p className="text-muted">Enter the email you gave us in the chat. We&rsquo;ll email you a link that opens it here, with everything so far.</p>
              {params.error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{params.error}</p>}
              <input type="hidden" name="next" value="/messages" />
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  className="rounded-lg border border-border bg-background px-4 py-2.5 text-base outline-none focus:border-foreground/40"
                />
              </label>
              <button type="submit" className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground hover:opacity-90">
                Email me the link
              </button>
              <a href="/messages" className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4">
                Start a new chat instead
              </a>
            </form>
          )}
        </div>
      </MessagesScreen>
    );
  }

  if (!user) {
    return (
      <MessagesScreen title={`Chat with ${CLUB.name}`} subtitle="Live chat">
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <p className="text-muted">Got a question? Send us a message and an engineer will reply here. No account needed.</p>
          <div className="mt-8">
            <GuestChatInit />
          </div>
        </div>
      </MessagesScreen>
    );
  }

  // Their booking texts and their chat here are the one thread.
  if (!user.is_anonymous) await adoptCustomerConversation(user.id, user.email);
  const conversation = await getOrCreateConversation(user.id);
  if (!conversation) {
    return (
      <MessagesScreen title="Messages">
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <h2 className="text-xl font-semibold tracking-tight">Chat is temporarily unavailable</h2>
          <p className="mt-2 text-muted">Please try again shortly, or get in touch another way.</p>
          <ContactOptions className="mt-6" />
        </div>
      </MessagesScreen>
    );
  }

  await ensureWelcome(conversation.id);
  const messages = await getConversationMessages(conversation.id);
  const guest = isGuestUser(user);
  // What the team sees in the presence line ("Jane is typing…").
  const presenceName = guest ? conversation.guestName || "Guest" : resolveDisplayName(user);
  const { appStore, playStore } = appLinks();

  return (
    <MessagesScreen title={CLUB.name} subtitle="Live chat · an engineer will reply here">
      <div className="flex min-h-0 flex-1 flex-col">
        <CustomerChat
          conversationId={conversation.id}
          initialMessages={messages}
          viewerId={user.id}
          presenceName={presenceName}
          hasEmail={!guest || !!conversation.guestEmail}
          hasMobile={!!conversation.phone}
          hasName={!guest || !!conversation.guestName}
          appStoreUrl={appStore}
          playStoreUrl={playStore}
          sendAction={sendMemberMessage}
          markReadAction={markConversationReadAsMember}
          getAttachmentUrlAction={getAttachmentUrl}
          fetchNewMessagesAction={getNewMessages}
          heartbeatAction={heartbeatMemberActivity}
          saveDetailsAction={saveChatDetails}
        />
      </div>
    </MessagesScreen>
  );
}
