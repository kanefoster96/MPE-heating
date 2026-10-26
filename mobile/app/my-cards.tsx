import { View } from "react-native";
import { AccountButton, AccountRow, AccountSection, AccountShell } from "@/components/account-bits";
import { AppText, haptic } from "@/components/ui";
import { accountAction, useMyAccount } from "@/lib/my-account";
import { confirmAction, notify } from "@/lib/confirm";
import { colors } from "@/lib/theme";

/** Their saved cards (the website account's): add one on Stripe's secure page, remove one not in use. */
export default function MyCardsScreen() {
  const { data, error, load } = useMyAccount();

  async function act(body: Record<string, unknown>) {
    const res = await accountAction(body);
    if (res?.message) {
      haptic.success();
      notify("Done", res.message);
    }
    load();
  }

  return (
    <AccountShell title="Saved cards" data={data} error={error} load={load}>
      {(d) =>
        !d.cardsOn ? (
          <AppText style={{ color: colors.text2, fontSize: 15, textAlign: "center", marginTop: 24 }}>Saved cards aren&apos;t switched on yet.</AppText>
        ) : (
          <>
            <AccountSection title="Your cards" intro="Cards you've saved with MPE. We always ask you before using one, unless it's for your plan or monthly payments you've agreed to.">
              {d.cards.length === 0 ? (
                <AppText style={{ color: colors.text2, fontSize: 15, paddingVertical: 14 }}>No cards saved.</AppText>
              ) : (
                d.cards.map((c, i) => (
                  <View key={c.id} style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <AccountRow title={c.label} detail={c.detail} tone={c.expired ? "bad" : "plain"} last={i === d.cards.length - 1} />
                    </View>
                    {c.removable && (
                      <AccountButton
                        title="Remove"
                        tone="danger"
                        onPress={async () => {
                          if (await confirmAction(`Remove your ${c.label}?`, "It won't be saved with MPE any more.", "Remove")) act({ action: "card_remove", id: c.id });
                        }}
                      />
                    )}
                  </View>
                ))
              )}
            </AccountSection>
            <AccountButton title="Add a card" onPress={() => act({ action: "card_add" })} />
            {d.plan?.on && <AccountButton title="Change the card for your plan" onPress={() => act({ action: "plan_billing" })} />}
            {d.paysMonthly && <AppText style={{ color: colors.text2, fontSize: 13 }}>To change the card for monthly payments, open that invoice in Invoices and receipts.</AppText>}
          </>
        )
      }
    </AccountShell>
  );
}
