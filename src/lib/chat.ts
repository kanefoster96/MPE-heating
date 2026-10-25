export type ChatAttachmentType = "image" | "video" | "file";

/** How a message actually reached its recipient — see chat_messages.channel in supabase/schema.sql. */
export type ChatChannel = "chat" | "email" | "sms";

export type ChatMessage = {
  id: string;
  conversationId: string;
  /** Null when the academy itself sent it rather than a person (the automatic email prompt). */
  senderId: string | null;
  senderIsCoach: boolean;
  body: string;
  channel: ChatChannel;
  attachmentPath: string | null;
  attachmentType: ChatAttachmentType | null;
  attachmentName: string | null;
  // Not a DB column — a short-lived signed URL resolved separately (see
  // getConversationMessages / getAttachmentSignedUrl in chat-db.ts), since
  // the storage bucket is private.
  attachmentUrl?: string | null;
  // Not DB columns either — resolved alongside the message (see
  // getConversationMessages in chat-db.ts) only for coach-sent messages, so
  // a member can see who they're actually talking to right on the bubble.
  senderName?: string | null;
  senderAvatarUrl?: string | null;
  /** Shown as a payment card with a Pay button (lib/payment-requests.ts). */
  paymentRequestId?: string | null;
  createdAt: string;
};

export type SendMessageInput = {
  body: string;
  /** Coach-only choice of how to actually deliver this — defaults to "chat" (in-app only) when omitted. */
  channel?: ChatChannel;
  attachmentPath?: string;
  attachmentType?: ChatAttachmentType;
  attachmentName?: string;
  /** A payment request this message carries (lib/payment-requests.ts): set only by createPaymentRequest. */
  paymentRequestId?: string;
};

/** Where the member/guest last sent from — see chat_conversations.member_last_source. */
export type ChatSource = "web" | "app";

export type Conversation = {
  id: string;
  userId: string;
  guestName: string | null;
  // Only ever set for a web guest who chose to leave one — a real member's
  // email lives on auth.users and is resolved when it's needed.
  guestEmail: string | null;
  lastMessageAt: string;
  memberLastReadAt: string | null;
  coachLastReadAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  memberLastSource: ChatSource | null;
  memberLastActiveAt: string | null;
  memberNotifiedAt: string | null;
  // The analytics_events.visitor_id (lib/analytics.ts) this conversation's
  // sender was carrying the first time we saw them — null if they'd
  // declined cookies, or the conversation predates this column.
  visitorId: string | null;
  // The number this conversation's "Text" send option sends to/receives
  // from — null until a coach sets one by hand, or contact happens by
  // phone first (see getOrCreateConversationByPhone in chat-db.ts).
  phone: string | null;
  /** The staff-only "Kanvas Team" group (lib/team-chat.ts). */
  isTeam?: boolean;
};

export type ConversationWithMember = Conversation & {
  displayName: string;
  isGuest: boolean;
  avatarUrl: string | null;
  completedByName: string | null;
  lastMessagePreview: string;
  /** Whether the latest message was ours — inboxes prefix the preview with "You:" like any messenger. */
  lastMessageFromCoach: boolean;
};

/**
 * What one person in a chat broadcasts over the conversation's Realtime
 * presence channel (see ChatThread) — enough for everyone else to show
 * "Marshal is viewing" / "Parent is typing…". Nothing here is persisted.
 */
export type ChatPresence = {
  role: "coach" | "member";
  name: string;
  typing: boolean;
};
