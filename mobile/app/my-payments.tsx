import { AccountRow, AccountSection, AccountShell } from "@/components/account-bits";
import { AppText } from "@/components/ui";
import { useMyAccount } from "@/lib/my-account";
import { openInApp } from "@/lib/open-link";
import { colors } from "@/lib/theme";

/**
 * Invoices, quotes and receipts (the website account's Payments and
 * Quotes). Each opens its own page in the app, to pay (Apple Pay), accept
 * a quote, or save and print the receipt.
 */
export default function MyPaymentsScreen() {
  const { data, error, load } = useMyAccount();
  return (
    <AccountShell title="Invoices and receipts" data={data} error={error} load={load}>
      {(d) => (
        <>
          {d.payments.length === 0 && d.quotes.length === 0 && d.planPayments.length === 0 && (
            <AppText style={{ color: colors.text2, fontSize: 15, textAlign: "center", marginTop: 24 }}>No invoices or quotes yet.</AppText>
          )}
          {d.payments.length > 0 && (
            <AccountSection title="Invoices" intro="Open any of them to pay, or for the receipt to print or save.">
              {d.payments.map((p, i) => (
                <AccountRow
                  key={p.id}
                  title={p.title}
                  detail={p.detail}
                  extra={p.monthly}
                  amount={p.amount}
                  status={p.status}
                  tone={p.failed ? "bad" : p.paid ? "good" : "open"}
                  onPress={() => openInApp(p.url)}
                  last={i === d.payments.length - 1}
                />
              ))}
            </AccountSection>
          )}
          {d.paysMonthly && <AppText style={{ color: colors.text2, fontSize: 13, marginHorizontal: 4, marginTop: -10 }}>Open an invoice you&apos;re paying monthly to pay some off or change the card.</AppText>}
          {d.quotes.length > 0 && (
            <AccountSection title="Quotes">
              {d.quotes.map((q, i) => (
                <AccountRow key={q.id} title={q.title} detail={q.detail} amount={q.amount} status={q.status} tone={q.tone} onPress={() => openInApp(q.url)} last={i === d.quotes.length - 1} />
              ))}
            </AccountSection>
          )}
          {d.planPayments.length > 0 && (
            <AccountSection title="Maintenance plan payments">
              {d.planPayments.map((pp, i) => (
                <AccountRow
                  key={pp.id}
                  title={pp.when}
                  amount={pp.amount}
                  status={pp.status === "paid" ? (pp.url ? "Receipt" : "Paid") : pp.status === "open" ? "Pay now" : pp.url ? "View" : undefined}
                  tone={pp.status === "open" ? "bad" : pp.status === "paid" ? "good" : "plain"}
                  onPress={pp.url ? () => openInApp(pp.url!) : undefined}
                  last={i === d.planPayments.length - 1}
                />
              ))}
            </AccountSection>
          )}
        </>
      )}
    </AccountShell>
  );
}
