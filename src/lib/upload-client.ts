"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Uploading a photo or file from the browser straight to storage, so big
 * phone photos never pass through a server function (Vercel caps a request
 * at 4.5MB). The server hands out a one-time signed upload for an exact
 * path (lib/job-files.ts), and the browser sends the file there.
 *
 * Photos are shrunk first: the longest side to 1600px as a JPEG, about
 * 200-400KB, plenty to see a boiler's error code or a finished install.
 */

const MAX_SIDE = 1600;

/** A photo, shrunk to a JPEG; anything else (a PDF certificate) as it is. */
export async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    // A format the browser can't draw (some HEIC): send it as it is.
    return file;
  }
}

/** Sends a file to the signed upload the server made for it. True when it's there. */
export async function uploadToSignedPath(bucket: string, path: string, token: string, body: Blob): Promise<boolean> {
  try {
    const { error } = await createClient().storage.from(bucket).uploadToSignedUrl(path, token, body, { contentType: body.type || "application/octet-stream" });
    return !error;
  } catch {
    return false;
  }
}
