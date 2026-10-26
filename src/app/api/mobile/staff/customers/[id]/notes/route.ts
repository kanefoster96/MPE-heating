import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { addCustomerNote, deleteCustomerNote, getCustomer } from "@/lib/customers";

/** A private note on a customer, from the app (only the team see them, as on the website). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const { body } = await readJson<{ body: string }>(request);
  const text = typeof body === "string" ? body.trim().slice(0, 2000) : "";
  if (!text) return mobileJson({ error: "Write the note first." }, 400);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(await getCustomer(id))) return mobileJson({ error: "That customer has gone." }, 404);
  if (!(await addCustomerNote(id, text, caller.user.id))) return mobileJson({ error: "Couldn't save that. Please try again." }, 500);
  return mobileJson({ ok: true });
}

/** Removes a note (`noteId`), as on the website's customer page. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const { noteId } = await readJson<{ noteId: string }>(request);
  if (!/^[0-9a-f-]{36}$/i.test(id) || typeof noteId !== "string") return mobileJson({ error: "Which note?" }, 400);
  return (await deleteCustomerNote(noteId, id)) ? mobileJson({ ok: true }) : mobileJson({ error: "Couldn't remove that. Please try again." }, 500);
}
