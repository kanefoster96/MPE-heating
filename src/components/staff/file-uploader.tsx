"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { shrinkImage, uploadToSignedPath } from "@/lib/upload-client";
import { requestFileUpload, saveFileUpload } from "@/app/staff/files/actions";
import { CERT_LABEL, CERT_TYPES, type CertType } from "@/lib/job-files-labels";

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-foreground/40 sm:text-sm";

/** A year on from "YYYY-MM-DD", less a day: when a gas safety record runs out. */
function yearOn(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Adding photos or a certificate for a customer (and the visit, when it's
 * from one): photos are shrunk on the phone first, then everything goes
 * straight to storage. A gas safety record's expiry fills itself in a year
 * on, which is what the renewal reminder runs from.
 */
export function FileUploader({ customerId, appointmentId = null, today }: { customerId: string; appointmentId?: string | null; today: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<"photo" | "certificate">("photo");
  const [certType, setCertType] = useState<CertType>("gas_safety");
  const [title, setTitle] = useState("");
  const [issuedOn, setIssuedOn] = useState(today);
  const [expiresOn, setExpiresOn] = useState(yearOn(today));
  const [shared, setShared] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, kind === "photo" ? 10 : 1);
    for (const [i, file] of list.entries()) {
      setBusy(list.length > 1 ? `Uploading ${i + 1} of ${list.length}…` : "Uploading…");
      const body = kind === "photo" ? await shrinkImage(file) : file;
      const type = body.type || file.type;
      const start = await requestFileUpload(customerId, type, body.size);
      if ("error" in start) {
        setError(start.error);
        break;
      }
      if (!(await uploadToSignedPath("job-files", start.path, start.token, body))) {
        setError("The upload didn't go through. Check the signal and try again.");
        break;
      }
      const saved = await saveFileUpload({
        customerId,
        appointmentId,
        kind,
        certType: kind === "certificate" ? certType : null,
        title,
        path: start.path,
        contentType: type,
        size: body.size,
        issuedOn: kind === "certificate" ? issuedOn : null,
        expiresOn: kind === "certificate" && expiresOn ? expiresOn : null,
        shared,
      });
      if (!saved.ok) {
        setError(saved.error);
        break;
      }
    }
    setBusy(null);
    setTitle("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3" data-file-uploader>
      <div className="flex gap-1.5" role="radiogroup" aria-label="What are you adding?">
        {(["photo", "certificate"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${kind === k ? "bg-foreground text-background" : "border border-border hover:border-foreground/40"}`}
          >
            {k === "photo" ? "Photos" : "Certificate"}
          </button>
        ))}
      </div>
      {kind === "certificate" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className="text-xs text-muted">Type</span>
            <select
              value={certType}
              onChange={(e) => {
                setCertType(e.target.value as CertType);
                if (e.target.value !== "gas_safety") setExpiresOn("");
                else setExpiresOn(yearOn(issuedOn));
              }}
              className={FIELD}
            >
              {CERT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CERT_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Issued</span>
            <input
              type="date"
              value={issuedOn}
              onChange={(e) => {
                setIssuedOn(e.target.value);
                if (certType === "gas_safety" && e.target.value) setExpiresOn(yearOn(e.target.value));
              }}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs text-muted">Runs out (reminder a month before)</span>
            <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={FIELD} />
          </label>
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Label (optional)</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={kind === "photo" ? "e.g. New boiler fitted" : "e.g. 12 Park Avenue, 2026"} className={FIELD} />
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="h-5 w-5 accent-[var(--color-accent)]" />
        Show it in their account
      </label>
      <label className={`inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground hover:opacity-90 ${busy ? "pointer-events-none opacity-50" : ""}`}>
        <input
          type="file"
          accept={kind === "photo" ? "image/*" : "application/pdf,image/*"}
          multiple={kind === "photo"}
          capture={kind === "photo" ? "environment" : undefined}
          className="sr-only"
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = "";
          }}
        />
        {busy ?? (kind === "photo" ? "Take or choose photos" : "Choose the certificate (PDF or photo)")}
      </label>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
