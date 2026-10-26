import { Platform } from "react-native";
import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";

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
