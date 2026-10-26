import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AccountButton, AccountShell } from "@/components/account-bits";
import { AppText, Card, haptic } from "@/components/ui";
import { accountAction, useMyAccount } from "@/lib/my-account";
import { confirmAction, notify } from "@/lib/confirm";
import { colors } from "@/lib/theme";

/**
 * Their maintenance plan (the website account's): what it includes, where
 * it's up to, updating the card, cancelling (it runs to the end of what's
 * paid for) or keeping it. Not on it: joining, on the plan's own page.
 */
export default function MyPlanScreen() {
  const { data, error, load } = useMyAccount();

  async function act(action: string) {
    const res = await accountAction({ action });
    if (res?.message) {
      haptic.success();
      notify("Done", res.message);
    }
    load();
  }

  return (
    <AccountShell title="Maintenance plan" data={data} error={error} load={load}>
      {(d) =>
        !d.plan ? (
          <AppText style={{ color: colors.text2, fontSize: 15, textAlign: "center", marginTop: 24 }}>The maintenance plan isn&apos;t open to join online yet. Message us if you&apos;d like to know more.</AppText>
        ) : (
          <Card style={{ gap: 12 }}>
            {d.plan.on && (
              <View style={{ alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: d.plan.tone === "bad" ? "#fdecec" : d.plan.tone === "good" ? "#e5f3ea" : colors.grey }}>
                <AppText weight="bold" style={{ fontSize: 12, color: d.plan.tone === "bad" ? colors.danger : d.plan.tone === "good" ? colors.success : colors.navy }}>
                  {d.plan.status}
                </AppText>
              </View>
            )}
            <View style={{ gap: 8 }}>
              {d.plan.benefits.map((b) => (
                <View key={b} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                  <Ionicons name="checkmark" size={18} color={colors.success} />
                  <AppText style={{ flex: 1, fontSize: 15, lineHeight: 21 }}>{b}</AppText>
                </View>
              ))}
            </View>
            <AppText style={{ color: colors.text2, fontSize: 15, lineHeight: 21 }}>{d.plan.line}</AppText>
            {d.plan.on ? (
              <>
                {d.plan.failed && (
                  <View style={{ backgroundColor: "#fdecec", borderRadius: 12, padding: 12 }}>
                    <AppText style={{ color: colors.danger, fontSize: 14 }}>Your last payment didn&apos;t go through. Update your card and we&apos;ll try again.</AppText>
                  </View>
                )}
                <AccountButton title="Update card and see payments" onPress={() => act("plan_billing")} />
                {d.plan.leaving ? (
                  <AccountButton title="Keep my plan" tone="orange" onPress={() => act("plan_keep")} />
                ) : (
                  <AccountButton
                    title="Cancel my plan"
                    tone="danger"
                    onPress={async () => {
                      if (d.plan?.on && (await confirmAction("Cancel your plan?", d.plan.cancelNote, "Yes, cancel it"))) act("plan_cancel");
                    }}
                  />
                )}
              </>
            ) : (
              <AccountButton title="Join the plan" tone="orange" onPress={() => act("plan_join")} />
            )}
          </Card>
        )
      }
    </AccountShell>
  );
}
