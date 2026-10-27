import { londonNow } from "@/lib/schedule-time";

/**
 * MPE's hours, every day (London): calls ring the team and customers'
 * messages notify them. Outside them, calls go to voicemail, the chat says
 * when we're back, and messages wait for one summary at 8am
 * (lib/follow-up-sweep.ts), so nobody's phone goes off at night.
 */
export const TEAM_FROM = 8 * 60;
export const TEAM_UNTIL = 20 * 60;

export function teamHours(): boolean {
  const { minutes } = londonNow();
  return minutes >= TEAM_FROM && minutes < TEAM_UNTIL;
}
