import { PlaceholderScreen } from "@/components/placeholder-screen";

/** Never shown: the team's Payment tab opens Take payment instead (see the tabs layout). */
export default function PaymentTab() {
  return <PlaceholderScreen icon="card-outline" title="Take payment" description="Opening Take payment…" />;
}
