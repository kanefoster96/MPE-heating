"use client";

import { useState, type ReactNode } from "react";

export type PageTab = {
  key: string;
  label: string;
  /** Unread/pending count shown as a badge on the pill — omitted (or 0) shows no badge at all. */
  count?: number;
};

// Color-codes each badge by what it means, not just "something's unread" —
// blue for messages, green for notifications, orange for anything needing a
// decision (requests). Any other tab key falls back to the orange default.
const BADGE_COLOR_BY_KEY: Record<string, string> = {
  chat: "bg-[#0a84ff]", // iOS Messages' iMessage blue
  notifications: "bg-emerald-500",
  requests: "bg-amber-500",
  jobs: "bg-accent", // MPE: new booking enquiries
};
const DEFAULT_BADGE_COLOR = "bg-amber-500";

/**
 * Three toggleable pills (Live Chat / Notifications / Requests, or whatever
 * the caller passes), each with its own unread/pending count, switching
 * between pre-rendered panels. All panels stay mounted — only the inactive
 * ones are hidden via CSS — so switching tabs never tears down ChatThread's
 * Realtime subscription or drops an in-progress draft.
 */
export function PageTabs({
  tabs,
  panels,
  defaultTab,
  railClassName = "",
}: {
  tabs: PageTab[];
  panels: Record<string, ReactNode>;
  defaultTab?: string;
  /**
   * Extra classes for the row of pills only. Lets a full-screen caller
   * inset the pills from the edge while its panel (a chat thread with its
   * own padding) still runs edge to edge.
   */
  railClassName?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`flex items-center gap-1 rounded-full border border-border bg-surface p-1 ${railClassName}`}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            aria-pressed={active === tab.key}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors ${
              active === tab.key
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            {!!tab.count && (
              <span
                className={`flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-background ${
                  BADGE_COLOR_BY_KEY[tab.key] ?? DEFAULT_BADGE_COLOR
                }`}
              >
                {tab.count > 99 ? "99+" : tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.key}
          className={`mt-4 flex min-h-0 flex-1 flex-col ${active === tab.key ? "" : "hidden"}`}
        >
          {panels[tab.key]}
        </div>
      ))}
    </div>
  );
}
