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
export default async function MessagesPage() {
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
