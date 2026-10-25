import type { Customer } from "@/lib/customers";

const FIELD =
  "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-base outline-none focus:border-foreground/40 sm:text-sm";

function Field({
  name,
  label,
  value,
  type = "text",
  autoComplete,
  hint,
  className = "",
}: {
  name: string;
  label: string;
  value: string | null | undefined;
  type?: string;
  autoComplete?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="text-sm text-muted">
        {label}
        {hint && <span className="text-muted"> ({hint})</span>}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        autoComplete={autoComplete ?? "off"}
        inputMode={type === "tel" ? "tel" : undefined}
        className={FIELD}
      />
    </label>
  );
}

/**
 * A customer's details and boiler, as form fields: the team's customer page
 * and the customer's own account share it. `withEmail` is off on the
 * customer's side, where the email is their login.
 */
export function CustomerFields({ customer, withEmail = true }: { customer?: Partial<Customer> | null; withEmail?: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted">Contact</legend>
        <Field name="name" label="Name" value={customer?.name} autoComplete="name" />
        <Field name="phone" label="Mobile" type="tel" value={customer?.phone} autoComplete="tel" />
        {withEmail && <Field name="email" label="Email" type="email" value={customer?.email} autoComplete="email" className="sm:col-span-2" />}
        <Field name="address" label="Address" value={customer?.address} autoComplete="street-address" className="sm:col-span-2" />
        <Field name="postcode" label="Postcode" value={customer?.postcode} autoComplete="postal-code" />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted">Boiler</legend>
        <Field name="boilerMake" label="Make" value={customer?.boilerMake} hint="e.g. Worcester Bosch" />
        <Field name="boilerModel" label="Model" value={customer?.boilerModel} />
        <Field name="boilerAge" label="Roughly how old" value={customer?.boilerAge} hint="e.g. 8 years" />
        <Field name="boilerLocation" label="Where it is" value={customer?.boilerLocation} hint="e.g. kitchen cupboard" />
        <Field name="lastService" label="Last serviced" value={customer?.lastService} hint="e.g. March 2025" />
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-sm text-muted">
          Anything for the visit <span className="text-muted">(parking, key safe, pets)</span>
        </span>
        <textarea name="accessNotes" defaultValue={customer?.accessNotes ?? ""} rows={3} className={FIELD} />
      </label>
    </div>
  );
}
