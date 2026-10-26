/** What the site's /api/mobile/home sends (src/app/api/mobile/home/route.ts on the site). */
export type HomeData = {
  business: { name: string; fullName: string; phoneDisplay: string; phoneHref: string; whatsappHref: string; gasSafeNumber: string; base: string };
  callout: {
    title: string;
    em: string;
    text: string;
    cta: string;
    bookUrl: string;
    sameDay: string;
    steps: { title: string; text: string }[];
    foot: string;
    fee: string;
  };
  services: { id: string; title: string; headline: string; line: string; icon: ServiceIcon; price: string; bookUrl: string; moreUrl: string | null }[];
  plan: { title: string; headline: string; points: string[]; price: string | null; bookUrl: string };
  guides: GuideSummary[];
};

export type ServiceIcon = "boiler" | "service" | "newboiler" | "plumbing" | "electrics" | "landlord";

export type GuideSummary = { slug: string; title: string; description: string; category: string; readTime: string };

export type ContentBlock = { type: "p"; text: string } | { type: "h2"; text: string } | { type: "list"; items: string[] } | { type: "callout"; text: string };

export type Guide = GuideSummary & { content: ContentBlock[]; relatedService: { label: string; url: string }; webUrl: string };

/** A chat message, as /api/mobile/chat/conversation sends it (src/lib/chat.ts on the site). */
export type ChatMessage = {
  id: string;
  conversationId: string;
  /** Null for MPE's automatic messages (the welcome). */
  senderId: string | null;
  senderIsCoach: boolean;
  body: string;
  channel: "chat" | "email" | "sms";
  attachmentPath: string | null;
  attachmentType: "image" | "video" | "file" | null;
  attachmentName: string | null;
  attachmentUrl?: string | null;
  senderName?: string | null;
  senderAvatarUrl?: string | null;
  createdAt: string;
  /** Only in the app: still sending, or (localUri) a photo still uploading. */
  pending?: boolean;
  localUri?: string;
};

export type ChatConversation = { id: string; title: string; phone: string | null; completed: boolean; isTeam: boolean };

export type ConversationResponse = { conversation: ChatConversation; messages: ChatMessage[]; viewer: { id: string; staff: boolean } };

export type InboxItem = {
  id: string;
  name: string;
  avatarUrl: string | null;
  guest: boolean;
  isTeam: boolean;
  preview: string;
  fromUs: boolean;
  lastMessageAt: string;
  unread: boolean;
  completed: boolean;
};

export type AppNotice = {
  id: string;
  icon: "card" | "document-text" | "calendar" | "shield-checkmark" | "time" | "construct" | "chatbubbles";
  title: string;
  text: string;
  at: string;
  action: boolean;
  url?: string;
  route?: string;
};
