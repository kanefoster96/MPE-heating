import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AvatarCircle } from "@/components/coach/avatar-circle";
import { isCoach } from "@/lib/coach";
import { resolveDisplayName } from "@/lib/display-name";
import { ChatThread } from "@/components/chat/chat-thread";
import { ConversationLiveWatcher } from "@/components/chat/conversation-live-watcher";
import { getConversationById, getConversationMessages, isGuestUser } from "@/lib/chat-db";
import { UndoIcon, CheckIcon, BackArrowIcon } from "@/components/coach/icons";
import { PhoneIcon } from "@/components/icons";
import type { SendMessageInput } from "@/lib/chat";
import { formatLondonClock, londonParts } from "@/lib/schedule-time";
import {
  sendCoachMessage,
  markConversationReadAsCoach,
  completeConversation,
  reopenConversation,
  getAttachmentUrl,
  getNewMessages,
  updateConversationPhone,
  getTeamReadReceipts,
  updateEnquiryStatus,
} from "../actions";
import { TEAM_CHAT_AVATAR_URL, TEAM_CHAT_NAME, teamReadReceipts } from "@/lib/team-chat";
import { CHAT_ON } from "@/lib/chat-on";
import { customerForConversation } from "@/lib/customers";
import { CATEGORY_LABEL, ENQUIRY_STATUSES, STATUS_LABEL, enquiriesForConversation, type EnquiryStatus } from "@/lib/enquiries";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatCompletedDate(iso: string): string {
  // London time — rendered on the server, whose clock is UTC.
  const { day, month } = londonParts(iso);
  return `${day} ${MONTHS[month]} at ${formatLondonClock(iso)}`;
}

const ICON_BUTTON =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-foreground/10 hover:text-foreground active:bg-foreground/15";

export default async function CoachConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const { error, success } = await searchParams;
  if (!CHAT_ON) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/staff/messages/${id}`);
  if (!(await isCoach(user.id))) redirect("/");

  const conversation = await getConversationById(id);
  if (!conversation) notFound();

  const conversationId = conversation.id;

  const admin = createAdminClient();
  const isTeam = !!conversation.isTeam;
  const { data: memberData } = isTeam
    ? { data: null }
    : await admin.auth.admin.getUserById(conversation.userId);
  const isGuest = !isTeam && isGuestUser(memberData?.user);
  // No texts from the chat: the only one MPE sends is the automatic one
  // after a call (lib/missed-calls.ts). Someone who's only phoned gets a
  // reply from WhatsApp Business, in the app.
  const smsAllowed = false;
  const displayName = isTeam
    ? TEAM_CHAT_NAME
    : isGuest
    ? conversation.guestName || "Guest"
    : memberData?.user
      ? resolveDisplayName(memberData.user)
      : "Unknown customer";
  const avatarUrl = isTeam
    ? TEAM_CHAT_AVATAR_URL
    : ((memberData?.user?.user_metadata?.avatar_url as string | undefined) ?? null);

  // Kanvas Academy links the name to the family's account or trial; MPE
  // links it to the customer's page (details, boiler, notes, visits).
  const customer = isTeam ? null : await customerForConversation(conversation.id);
  const profileHref: string | null = customer ? `/staff/customers/${customer.id}` : null;

  const isCompleted = !!conversation.completedAt;
  let completedByLabel: string | null = null;
  if (conversation.completedBy === user.id) {
    completedByLabel = "You";
  } else if (conversation.completedBy) {
    const { data: completerData } = await admin.auth.admin.getUserById(conversation.completedBy);
    completedByLabel = completerData?.user ? resolveDisplayName(completerData.user) : "Someone on the team";
  }

  // One line under the name: how they last got in touch (so a coach knows a
  // plain reply reaches them by email or just their app badge), or where
  // they are on the site right now, or when this was closed.
  let subtitle: string;
  if (isTeam) {
    subtitle = "Admins and engineers";
  } else if (isCompleted) {
    subtitle = `Completed${completedByLabel ? ` by ${completedByLabel}` : ""}${
      conversation.completedAt ? ` · ${formatCompletedDate(conversation.completedAt)}` : ""
    }`;
  } else if (conversation.memberLastSource === "app") {
    subtitle = "Messaging from the app";
  } else if (conversation.memberLastSource === "web") {
    subtitle = "Messaging from the website · replies are emailed if they've left";
  } else if (conversation.phone && isGuest) {
    subtitle = "Texts and calls";
  } else if (isGuest) {
    subtitle = "Website visitor";
  } else {
    subtitle = "Open conversation";
  }

  const [messages, jobs] = await Promise.all([
    getConversationMessages(conversationId),
    isTeam ? Promise.resolve([]) : enquiriesForConversation(conversationId),
  ]);

  async function send(input: SendMessageInput) {
    "use server";
    return sendCoachMessage(conversationId, input);
  }

  async function markRead() {
    "use server";
    await markConversationReadAsCoach(conversationId);
  }

  async function updatePhone(phone: string) {
    "use server";
    return updateConversationPhone(conversationId, phone);
  }

  async function complete() {
    "use server";
    const result = await completeConversation(conversationId);
    revalidatePath(`/staff/messages/${conversationId}`);
    revalidatePath("/staff/messages");
    if (!result.success) {
      redirect(
        `/staff/messages/${conversationId}?error=` + encodeURIComponent(result.error),
      );
    }
    redirect(`/staff/messages/${conversationId}?success=completed`);
  }

  async function reopen() {
    "use server";
    const result = await reopenConversation(conversationId);
    revalidatePath(`/staff/messages/${conversationId}`);
    revalidatePath("/staff/messages");
    if (!result.success) {
      redirect(
        `/staff/messages/${conversationId}?error=` + encodeURIComponent(result.error),
      );
    }
    redirect(`/staff/messages/${conversationId}?success=reopened`);
  }

  const identity = (
    <>
      <AvatarCircle name={displayName} avatarUrl={avatarUrl} size="md" />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate font-semibold leading-tight">
          <span className="truncate">{displayName}</span>
        </p>
        <p className="truncate text-xs text-muted">{subtitle}</p>
      </div>
    </>
  );

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-2xl flex-col sm:px-6 sm:py-6">
      <ConversationLiveWatcher conversationId={conversationId} />

      <header className="flex items-center gap-2 px-2 py-2 sm:mb-3 sm:rounded-2xl sm:border sm:border-border sm:bg-surface sm:px-3">
        <Link href="/staff/messages" aria-label="Back to Messages" className={ICON_BUTTON}>
          <BackArrowIcon className="h-5 w-5" />
        </Link>

        {profileHref ? (
          <Link
            href={profileHref}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-full py-1 pr-2 transition-colors hover:bg-foreground/5 active:bg-foreground/10"
          >
            {identity}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3 py-1 pr-2">{identity}</div>
        )}

        {conversation.phone && (
          <a href={`tel:${conversation.phone}`} aria-label={`Call ${displayName}`} className={ICON_BUTTON}>
            <PhoneIcon className="h-5 w-5" />
          </a>
        )}

        {isTeam ? null : isCompleted ? (
          <form action={reopen}>
            <button type="submit" aria-label="Reopen conversation" title="Reopen" className={ICON_BUTTON}>
              <UndoIcon className="h-5 w-5" />
            </button>
          </form>
        ) : (
          <form action={complete}>
            <button
              type="submit"
              aria-label="Mark complete"
              title="Mark complete"
              className={ICON_BUTTON}
            >
              <CheckIcon className="h-5 w-5" />
            </button>
          </form>
        )}
      </header>

      {success && (
        <p className="mx-4 mb-2 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success sm:mx-0">
          {success === "completed"
            ? "Marked complete and moved to History."
            : success === "reopened"
              ? "Conversation reopened."
              : "Done."}
        </p>
      )}
      {error && (
        <p className="mx-4 mb-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger sm:mx-0">
          {error}
        </p>
      )}

      {/* This customer's bookings, each with where it's up to. */}
      {jobs.length > 0 && (
        <div className="mx-4 mb-2 flex flex-col gap-2 sm:mx-0" data-jobs>
          {jobs.map((job) => (
            <div key={job.id} className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {CATEGORY_LABEL[job.category]}
                  {job.sameDay && <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">Same day</span>}
                  {job.postcode && <span className="ml-2 text-xs font-normal text-muted">{job.postcode}</span>}
                </p>
                <div className="flex flex-wrap gap-1">
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
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <ChatThread
          conversationId={conversationId}
          initialMessages={messages}
          viewerId={user.id}
          presence={{ role: "coach", name: resolveDisplayName(user) }}
          sendAction={send}
          markReadAction={markRead}
          getAttachmentUrlAction={getAttachmentUrl}
          fetchNewMessagesAction={getNewMessages}
          emptyLabel="No messages yet."
          locked={isCompleted}
          lockedMessage="This conversation is marked complete — tap ↺ above to reopen it."
          flush
          channelPicker={isTeam ? undefined : { phone: conversation.phone, smsAllowed, updatePhoneAction: updatePhone }}
          staffThread={isTeam}
          readers={isTeam ? await teamReadReceipts(user.id) : undefined}
          loadReaders={isTeam ? getTeamReadReceipts : undefined}
        />
      </div>
    </div>
  );
}
