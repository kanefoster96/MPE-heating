"use client";

import { useEffect, useRef, useState } from "react";
import { business } from "@/lib/content";
import { shrinkImage, uploadToSignedPath } from "@/lib/upload-client";
import { CameraIcon, CloseIcon, WhatsAppIcon } from "./icons";

// The booking forms' optional photo step (lib/flows.ts, kind "photos").
// Each photo is shrunk on the phone and sent straight to storage, one at a
// time, as soon as it's picked, so by the contact step they're already
// there and only their paths go with the form. The list lives in StepFlow
// (through this hook) so it survives going back and forward a step.

/** Bigger than this before shrinking is turned away (the upload route says the same). */
const MAX_BYTES = 10 * 1024 * 1024;
// Matches MAX_PHOTO_SLOTS in lib/enquiry-photos.ts: past it, a new folder.
const MAX_SLOTS = 20;

export type BookingPhoto = {
  key: string;
  file: File;
  preview: string;
  state: "uploading" | "done" | "failed";
  path?: string;
};

export function useBookingPhotos(max: number) {
  const [photos, setPhotos] = useState<BookingPhoto[]>([]);
  // The server said uploads aren't set up (503): say WhatsApp instead.
  const [off, setOff] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const batch = useRef<string | null>(null);
  const slot = useRef(0);
  const previews = useRef<Set<string>>(new Set());

  // Let go of the previews when the form goes.
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const patch = (key: string, next: Partial<BookingPhoto>) => setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...next } : p)));

  async function upload(photo: BookingPhoto): Promise<"ok" | "failed" | "off"> {
    patch(photo.key, { state: "uploading" });
    if (slot.current >= MAX_SLOTS) {
      batch.current = null;
      slot.current = 0;
    }
    const n = ++slot.current;
    try {
      const blob = await shrinkImage(photo.file);
      const res = await fetch("/api/uploads/booking-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: blob.type || photo.file.type, size: photo.file.size, batch: n > 1 ? batch.current : null, n }),
      });
      if (res.status === 503) return "off";
      if (!res.ok) {
        patch(photo.key, { state: "failed" });
        return "failed";
      }
      const { path, token, batch: folder } = (await res.json()) as { path: string; token: string; batch: string };
      batch.current = folder;
      const ok = await uploadToSignedPath("job-files", path, token, blob);
      patch(photo.key, ok ? { state: "done", path } : { state: "failed" });
      return ok ? "ok" : "failed";
    } catch {
      patch(photo.key, { state: "failed" });
      return "failed";
    }
  }

  function clear() {
    previews.current.forEach((u) => URL.revokeObjectURL(u));
    previews.current.clear();
    setPhotos([]);
    setNote(null);
  }

  async function add(files: File[]) {
    setNote(null);
    const room = max - photos.length;
    const images = files.filter((f) => f.type.startsWith("image/"));
    const small = images.filter((f) => f.size <= MAX_BYTES);
    if (images.length < files.length) setNote("Photos only, please.");
    else if (small.length < images.length) setNote("That photo is over 10MB. Try a smaller one, or send it on WhatsApp.");
    else if (small.length > room) setNote(`Up to ${max} photos. We added the first ${room === 1 ? "one" : room}.`);
    const added = small.slice(0, Math.max(room, 0)).map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { key: crypto.randomUUID(), file, preview, state: "uploading" as const };
    });
    if (!added.length) return;
    setPhotos((prev) => [...prev, ...added]);
    // One at a time, so a form's photos share a folder and a slow phone
    // connection isn't asked to do five at once.
    for (const photo of added) {
      if ((await upload(photo)) === "off") {
        setOff(true);
        clear();
        return;
      }
    }
  }

  function remove(key: string) {
    const photo = photos.find((p) => p.key === key);
    if (photo) {
      URL.revokeObjectURL(photo.preview);
      previews.current.delete(photo.preview);
    }
    setPhotos((prev) => prev.filter((p) => p.key !== key));
    setNote(null);
  }

  async function retry(key: string) {
    const photo = photos.find((p) => p.key === key);
    if (photo && (await upload(photo)) === "off") {
      setOff(true);
      clear();
    }
  }

  const paths = photos.flatMap((p) => (p.state === "done" && p.path ? [p.path] : []));
  const uploading = photos.some((p) => p.state === "uploading");
  return { photos, off, note, paths, uploading, add, remove, retry, clear };
}

export function PhotoPicker({ max, state }: { max: number; state: ReturnType<typeof useBookingPhotos> }) {
  const { photos, off, note, uploading, add, remove, retry } = state;
  const input = useRef<HTMLInputElement>(null);
  const failed = photos.filter((p) => p.state === "failed").length;
  const done = photos.filter((p) => p.state === "done").length;

  if (off) {
    return (
      <div className="rounded-lg border border-line bg-cream px-4 pt-3 pb-1 text-sm text-text-2" data-photos-off>
        <p>Photos can&rsquo;t be added here just now. You can send them to us on WhatsApp instead, after you&rsquo;ve sent this.</p>
        <a href={business.whatsappHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-whatsapp-ink underline underline-offset-4">
          <WhatsAppIcon className="h-4 w-4" aria-hidden="true" />
          WhatsApp us
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5" aria-label="Your photos">
          {photos.map((p, i) => (
            <li key={p.key} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-cream" data-photo={p.state}>
              {/* A local preview (blob: URL), so next/image has nothing to optimise. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              {p.state === "uploading" && (
                <span className="absolute inset-x-0 bottom-0 bg-navy/75 px-1 py-1 text-center text-xs font-semibold text-white">Uploading…</span>
              )}
              {p.state === "failed" && (
                <button
                  type="button"
                  onClick={() => void retry(p.key)}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-white/85 px-1 pt-6 text-center text-xs font-semibold text-navy"
                >
                  Didn&rsquo;t upload
                  <span className="underline underline-offset-2">Try again</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(p.key)}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute right-0 top-0 grid h-11 w-11 place-items-center"
              >
                <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-navy/80 text-white">
                  <CloseIcon className="h-4 w-4" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {photos.length < max && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              // So picking the same photo again after removing it still counts.
              e.target.value = "";
              if (files.length) void add(files);
            }}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex min-h-16 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-navy/30 bg-cream px-4 py-3 text-[15px] font-semibold text-navy transition-colors hover:border-navy/50 active:bg-navy/10"
          >
            <CameraIcon className="h-5 w-5" aria-hidden="true" />
            {photos.length ? "Add another photo" : "Add a photo"}
          </button>
        </>
      )}

      <p aria-live="polite" className="text-xs text-text-2">
        {uploading
          ? "Uploading…"
          : failed
            ? failed === 1
              ? "One photo didn’t upload. Tap it to try again, or remove it."
              : `${failed} photos didn’t upload. Tap them to try again, or remove them.`
            : done
              ? `${done} of ${max} added.`
              : `Up to ${max} photos.`}
      </p>
      {note && <p className="text-sm text-text-2">{note}</p>}
    </div>
  );
}
