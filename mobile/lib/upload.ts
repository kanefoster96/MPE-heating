import { Platform } from "react-native";
import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";

/**
 * A photo from the camera or library, into the conversation's folder in
 * the private chat-attachments bucket (Kanvas Academy's lib/upload.ts).
 * The bucket's rules let the person whose chat it is (or the team) add to
 * it; the message then carries the path, and the site checks it's this
 * conversation's folder before saving it.
 */
export async function uploadChatPhoto(conversationId: string, uri: string, mimeType = "image/jpeg"): Promise<string> {
  if (!supabase) throw new Error("Photos aren't switched on yet.");
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/heic" ? "heic" : mimeType === "image/webp" ? "webp" : "jpg";
  const path = `${conversationId}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const bytes = Platform.OS === "web" ? await (await fetch(uri)).arrayBuffer() : await new File(uri).arrayBuffer();
  const { error } = await supabase.storage.from("chat-attachments").upload(path, bytes, { contentType: mimeType });
  if (error) throw new Error("Couldn't send that photo. Please try again.");
  return path;
}

/**
 * A photo or certificate for a customer's job, into the private job-files
 * bucket: the site gives a one-time upload (lib/job-files.ts), the file
 * goes straight there, and the site then saves it with the job. Returns
 * what to save it with.
 */
export async function uploadJobFile(customerId: string, uri: string, mimeType: string): Promise<{ path: string; contentType: string; size: number }> {
  if (!supabase) throw new Error("Uploads aren't switched on yet.");
  const bytes = Platform.OS === "web" ? await (await fetch(uri)).arrayBuffer() : await new File(uri).arrayBuffer();
  const contentType = mimeType || "image/jpeg";
  const start = await apiPost<{ path: string; token: string }>("/api/mobile/staff/files/start", { customerId, contentType, size: bytes.byteLength });
  const { error } = await supabase.storage.from("job-files").uploadToSignedUrl(start.path, start.token, bytes, { contentType });
  if (error) throw new Error("The upload didn't go through. Check the signal and try again.");
  return { path: start.path, contentType, size: bytes.byteLength };
}
