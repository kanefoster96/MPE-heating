import { PlaceholderScreen } from "@/components/placeholder-screen";

/** Never shown: the tab opens the call-out request instead (see the tabs layout). */
export default function CallOutTab() {
  return <PlaceholderScreen icon="flame-outline" title="Request a call-out" description="Opening the call-out request…" />;
}
