import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageTabs } from "@/components/page-tabs";
import { AvatarCircle } from "@/components/coach/avatar-circle";
import { isCoach } from "@/lib/coach";
import {
  getConversationsForCoach,
  findConversationIdsMatchingText,
  getUnreadCountForCoach,
} from "@/lib/chat-db";
import { LiveRefresher } from "@/components/coach/live-refresher";
import { ConversationPresenceBadge } from "@/components/chat/conversation-presence-badge";
import { updateEnquiryStatus } from "./actions";
import {
  CATEGORY_LABEL,
  ENQUIRY_CATEGORIES,
  ENQUIRY_STATUSES,
  STATUS_LABEL,
  listEnquiries,
  openEnquiryCategories,
  type Enquiry,
  type EnquiryCategory,
  type EnquiryStatus,
} from "@/lib/enquiries";
import { CHAT_ON } from "@/lib/chat-on";
import type { ConversationWithMember } from "@/lib/chat";
import { formatLondonClock, londonNow, londonParts } from "@/lib/schedule-time";
import { PaperPlaneIcon } from "@/components/coach/icons";
import { withTeamChat } from "@/lib/team-chat";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatActivityDate(iso: string): string {
  // London calendar days and clock — rendered on the server, whose clock is
  // UTC, so a late-evening BST message would otherwise land on the wrong day.
  const date = londonParts(iso);
  const today = londonParts(new Date());
  const diffDays = Math.round((Date.UTC(today.year, today.month, today.day) - Date.UTC(date.year, date.month, date.day)) / 86_400_000);

  if (diffDays === 0) return formatLondonClock(iso);
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return WEEKDAYS[date.weekday];
  return `${date.day} ${MONTHS[date.month]}`;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
      <circle cx="11" cy="11" r="6.5" />
      <path strokeLinecap="round" d="m20 20-4-4" />
    </svg>
  );
}

function isUnread(c: ConversationWithMember): boolean {
  return !c.completedAt && (!c.coachLastReadAt || c.lastMessageAt > c.coachLastReadAt);
}

function ConversationRow({
  c,
  viewerId,
  job,
}: {
  c: ConversationWithMember;
  viewerId: string;
  /** This customer's open booking, if any. */
  job: EnquiryCategory | undefined;
}) {
  const isCompleted = !!c.completedAt;
  const unread = isUnread(c);

  return (
    <Link
      href={`/staff/messages/${c.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-background/50 active:bg-background/70"
    >
      <div className="relative shrink-0">
        <AvatarCircle name={c.displayName} avatarUrl={c.avatarUrl} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={`truncate ${unread ? "font-semibold" : "font-medium"}`}>
              {c.displayName}
            </span>
            {c.isGuest && (
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                Visitor
              </span>
            )}
            {job && (
              <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                {CATEGORY_LABEL[job]}
              </span>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted">
            {formatActivityDate(c.lastMessageAt)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className={`truncate text-sm ${unread ? "text-foreground" : "text-muted"}`}>
            {c.lastMessagePreview
              ? `${c.lastMessageFromCoach ? "You: " : ""}${c.lastMessagePreview}`
              : "No messages yet"}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {isCompleted ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted">
                Completed{c.completedByName ? ` · ${c.completedByName}` : ""}
              </span>
            ) : (
              <>
                {c.memberLastSource === "app" && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted">
                    App
                  </span>
                )}
                <ConversationPresenceBadge conversationId={c.id} viewerId={viewerId} />
              </>
            )}
            {unread && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function ConversationList({
  conversations,
  viewerId,
  jobs,
  emptyText,
}: {
  conversations: ConversationWithMember[];
  viewerId: string;
  jobs: Map<string, EnquiryCategory>;
  emptyText: string;
}) {
  if (conversations.length === 0) {
    return (
      <p className="mt-3 rounded-2xl border border-border bg-surface/50 p-6 text-center text-sm text-muted">
        {emptyText}
      </p>
    );
  }

  // The team chat sits above the list as its own card.
  const team = conversations.find((c) => c.isTeam);
  const rest = conversations.filter((c) => !c.isTeam);

  return (
    <>
      {team && <TeamCard c={team} />}
      {rest.length > 0 && (
    <div className="mt-3 flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
      {rest.map((c) => (
        <ConversationRow
          key={c.id}
          c={c}
          viewerId={viewerId}
          job={jobs.get(c.id)}
        />
      ))}
    </div>
      )}
    </>
  );
}

/** The staff group chat, pinned above every family as a card. */
function TeamCard({ c }: { c: ConversationWithMember }) {
  const unread = isUnread(c);
  return (
    <Link
      href={`/staff/messages/${c.id}`}
      className={`mt-3 flex items-center gap-3 rounded-2xl border bg-surface p-4 transition-colors hover:bg-background/50 active:bg-background/70 ${
        unread ? "border-accent" : "border-border"
      }`}
    >
      <AvatarCircle name={c.displayName} avatarUrl={c.avatarUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold">{c.displayName}</span>
          <span className="shrink-0 text-xs text-muted">{formatActivityDate(c.lastMessageAt)}</span>
        </div>
        <p className="text-xs text-muted">Pinned · admins and engineers</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className={`line-clamp-2 text-sm ${unread ? "text-foreground" : "text-muted"}`}>
            {c.lastMessagePreview
              ? `${c.lastMessageFromCoach ? "You: " : ""}${c.lastMessagePreview}`
              : "No messages yet"}
          </p>
          {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
        </div>
      </div>
    </Link>
  );
}

function formatJobDate(iso: string): string {
  const { day, month } = londonParts(iso);
  return `${day} ${MONTHS[month]}, ${formatLondonClock(iso)}`;
}

/** One booking enquiry: what, where, who, and where it's up to. */
function JobCard({ job }: { job: Enquiry }) {
  const details = job.answers.filter((a) => a.q !== "Postcode").map((a) => a.a);
  return (
    <article className="rounded-2xl border border-border bg-surface p-4" data-job={job.category}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">{CATEGORY_LABEL[job.category]}</span>
            {job.sameDay && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">Same day</span>}
            <span className="truncate">{job.name || job.email || job.phone || "Customer"}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {formatJobDate(job.createdAt)}
            {job.postcode ? ` · ${job.postcode}` : ""}
            {job.path.length ? ` · ${job.path.join(" › ")}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(job.status === "new" || job.status === "contacted") && (
            <Link
              href={`/staff/schedule?view=day&date=${londonNow().dateISO}&enquiry=${job.id}#add`}
              className="inline-flex min-h-9 items-center rounded-full bg-accent px-3 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90"
            >
              Book it
            </Link>
          )}
          {job.customerId && (
            <Link
              href={`/staff/customers/${job.customerId}`}
              className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs font-semibold transition-colors hover:border-foreground/40"
            >
              Customer
            </Link>
          )}
          {job.conversationId && (
            <Link
              href={`/staff/messages/${job.conversationId}`}
              className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs font-semibold transition-colors hover:border-foreground/40"
            >
              Open chat
            </Link>
          )}
        </div>
      </div>
      {(details.length > 0 || job.message) && (
        <p className="mt-2 line-clamp-3 text-sm text-foreground">{[...details, job.message].filter(Boolean).join(" · ")}</p>
      )}
      <p className="mt-2 text-xs text-muted">{[job.email, job.phone].filter(Boolean).join(" · ")}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {ENQUIRY_STATUSES.map((status: EnquiryStatus) => (
          <form key={status} action={updateEnquiryStatus.bind(null, job.id, status)}>
            <button
              type="submit"
              aria-pressed={job.status === status}
              className={`min-h-9 rounded-full border px-3 text-xs font-medium transition-colors ${
                job.status === status ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted hover:border-foreground/40"
              }`}
            >
              {STATUS_LABEL[status]}
            </button>
          </form>
        ))}
      </div>
    </article>
  );
}

// The team inbox (Kanvas Academy's coach inbox): every customer
// conversation — website chat, texts, missed calls, voicemail, email
// replies — and the team chat, plus MPE's Jobs: every booking form, by
// category and status.
export default async function StaffMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; cat?: string; status?: string }>;
}) {
  const { q, tab, cat, status } = await searchParams;
  if (!CHAT_ON) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/staff/messages");
  if (!(await isCoach(user.id))) redirect("/");

  const category = (ENQUIRY_CATEGORIES as readonly string[]).includes(cat ?? "") ? (cat as EnquiryCategory) : undefined;
  const statusFilter = (ENQUIRY_STATUSES as readonly string[]).includes(status ?? "") ? (status as EnquiryStatus) : undefined;

  const [conversations, unreadChatCount, jobs, openJobs, newJobs] = await Promise.all([
    getConversationsForCoach().then((list) => withTeamChat(list, user.id)),
    getUnreadCountForCoach(user.id),
    listEnquiries({ category, status: statusFilter }),
    openEnquiryCategories(),
    listEnquiries({ status: "new" }),
  ]);

  const trimmedQuery = q?.trim() ?? "";
  const matchingIds = trimmedQuery ? await findConversationIdsMatchingText(trimmedQuery) : null;
  const needle = trimmedQuery.toLowerCase();
  const visibleConversations = matchingIds
    ? conversations.filter((c) => c.displayName.toLowerCase().includes(needle) || matchingIds.has(c.id))
    : conversations;

  const byRecency = (a: ConversationWithMember, b: ConversationWithMember) =>
    new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();

  // Anything waiting on a reply first, then the rest that are open, then
  // History; the team chat pinned on top.
  const waiting = visibleConversations.filter((c) => isUnread(c)).sort(byRecency);
  const open = visibleConversations.filter((c) => !isUnread(c) && !c.completedAt).sort(byRecency);
  const history = visibleConversations
    .filter((c) => !!c.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
  const orderedConversations = [...waiting, ...open, ...history].sort((a, b) => Number(!!b.isTeam) - Number(!!a.isTeam));

  const chip = (active: boolean) =>
    `inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold transition-colors ${
      active ? "border-foreground bg-foreground text-background" : "border-border text-muted hover:border-foreground/40"
    }`;
  const jobsHref = (next: { cat?: string; status?: string }) => {
    const params = new URLSearchParams({ tab: "jobs" });
    if (next.cat) params.set("cat", next.cat);
    if (next.status) params.set("status", next.status);
    return `/staff/messages?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <LiveRefresher />
      <p className="text-sm uppercase tracking-widest text-muted">MPE team</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Inbox</h1>

      <div className="mt-6">
        <PageTabs
          defaultTab={tab === "jobs" ? "jobs" : "chat"}
          tabs={[
            { key: "chat", label: "Live chat", count: unreadChatCount },
            { key: "jobs", label: "Jobs", count: newJobs.length },
          ]}
          panels={{
            chat: (
              <section>
                <Link
                  href="/staff/messages/new"
                  className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 active:opacity-75"
                >
                  <PaperPlaneIcon /> Text a customer
                </Link>
                <form method="get" className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                    <SearchIcon />
                  </span>
                  <input
                    type="text"
                    name="q"
                    defaultValue={q ?? ""}
                    placeholder="Search by name or text in a message"
                    className="w-full rounded-full border border-border bg-background py-2.5 pl-10 pr-4 text-base outline-none focus:border-foreground/40 sm:text-sm"
                  />
                </form>

                {trimmedQuery ? (
                  <>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted">
                      <span>
                        {visibleConversations.length} result{visibleConversations.length === 1 ? "" : "s"} for &ldquo;{trimmedQuery}&rdquo;
                      </span>
                      <Link href="/staff/messages" className="underline underline-offset-4 transition-colors hover:text-foreground">
                        Clear
                      </Link>
                    </div>
                    <ConversationList
                      conversations={[...visibleConversations].sort(byRecency)}
                      viewerId={user.id}
                      jobs={openJobs}
                      emptyText={`No conversations match “${trimmedQuery}”.`}
                    />
                  </>
                ) : (
                  <ConversationList conversations={orderedConversations} viewerId={user.id} jobs={openJobs} emptyText="No conversations yet." />
                )}
              </section>
            ),
            jobs: (
              <section>
                <div className="flex flex-wrap gap-1.5">
                  <Link href={jobsHref({ status })} className={chip(!category)}>
                    All
                  </Link>
                  {ENQUIRY_CATEGORIES.map((c) => (
                    <Link key={c} href={jobsHref({ cat: c, status })} className={chip(category === c)}>
                      {CATEGORY_LABEL[c]}
                    </Link>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Link href={jobsHref({ cat: category })} className={chip(!statusFilter)}>
                    Any status
                  </Link>
                  {ENQUIRY_STATUSES.map((s) => (
                    <Link key={s} href={jobsHref({ cat: category, status: s })} className={chip(statusFilter === s)}>
                      {STATUS_LABEL[s]}
                    </Link>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  {jobs.length === 0 ? (
                    <p className="rounded-2xl border border-border bg-surface/50 p-6 text-center text-sm text-muted">No jobs here yet.</p>
                  ) : (
                    jobs.map((job) => <JobCard key={job.id} job={job} />)
                  )}
                </div>
              </section>
            ),
          }}
        />
      </div>
    </div>
  );
}
