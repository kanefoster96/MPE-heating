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

/** A customer's job (src/lib/app-jobs.ts on the site). */
export type JobStep = { label: string; detail?: string; state: "done" | "now" | "next" };
export type JobCard = {
  id: string;
  title: string;
  when: string;
  status: "underway" | "booked" | "requested" | "waiting" | "missed" | "done";
  statusLabel: string;
  steps: JobStep[];
  report: string | null;
  actions: { label: string; url: string; primary?: boolean }[];
};

/** One of the team's visits for a day. */
export type StaffJob = {
  id: string;
  kind: string;
  title: string | null;
  status: "requested" | "booked" | "done" | "no_access" | "cancelled";
  window: string;
  start: number;
  end: number;
  customer: { name: string | null; phone: string | null; conversationId: string | null } | null;
  address: string | null;
  postcode: string | null;
  notes: string | null;
  onMyWay: string | null;
  changeRequested: boolean;
  openPayment: { id: string; amount: string } | null;
  paid: boolean;
};

export type StaffDay = {
  day: string;
  label: string;
  closed: string | null | false;
  jobs: StaffJob[];
  strip: { day: string; count: number; closed: boolean }[];
  waiting: number;
};

/** An invoice or call-out fee on the Payment sheet (src/lib/app-jobs.ts on the site). */
export type JobPayment = {
  id: string;
  number: string;
  kind: "callout_fee" | "invoice" | "other";
  description: string;
  /** What's left to pay. */
  amount: string;
  amountPence: number;
  total: string;
  /** Paid towards it already (cash first, say), while it's open. */
  paidSoFar: string | null;
  status: "open" | "paid";
  paidVia: string | null;
  monthly: boolean;
  /** "this" job, "none" yet, or the other visit's date. */
  job: string;
};

/** What the Payment sheet needs (src/lib/app-payments.ts on the site). */
export type SheetContext = {
  jobId: string | null;
  customerName: string | null;
  on: boolean;
  terminalLocation: string | null;
  savedCard: { brand: string; last4: string } | null;
  choices: JobPayment[];
};

export type StaffJobDetail = {
  job: StaffJob;
  day: string;
  dayLabel: string;
  payments: {
    on: boolean;
    terminalLocation: string | null;
    savedCard: { brand: string; last4: string } | null;
    forJob: JobPayment[];
    otherOpen: JobPayment[];
  };
};

/** Fergal's Menu (src/lib/app-menu.ts on the site). */
export type MenuCard = {
  id: string;
  icon: string;
  title: string;
  value: string;
  caption: string;
  tone: "alert" | "good" | "plain";
  /** How many things need him here (the row's count). */
  count: number;
  route?: string;
  path?: string;
};
export type StaffOverview = { name: string; attention: number; cards: MenuCard[]; admin: boolean };

export type StaffFinance = {
  months: { month: string; label: string; takenPence: number; taken: string; payments: number }[];
  thisMonth: string;
  lastMonth: string;
  owed: string;
  unpaid: number;
  overdue: number;
  planMonthly: string;
  planMembers: number;
  quotesOut: string;
  quotesOpen: number;
};

export type MonthNumbers = {
  month: string;
  takenPence: number;
  payments: number;
  jobsDone: number;
  enquiries: number;
  bySource: { source: string; count: number }[];
  quotesSent: number;
  quotesSentPence: number;
  quotesWon: number;
  quotesWonPence: number;
  planMembers: number;
  planJoined: number;
  planLeft: number;
  reviews: number;
  reviewAverage: number | null;
  toGoogle: number;
  referrals: number;
};
export type StaffMetrics = { month: string; label: string; previous: string; previousLabel: string; now: MonthNumbers; before: MonthNumbers };
