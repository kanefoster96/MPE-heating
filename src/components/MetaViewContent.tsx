"use client";

import { useEffect, useRef } from "react";
import { trackMetaEvent } from "@/lib/meta-pixel";

/**
 * Sends Meta's ViewContent for the service a page is about (Kanvas
 * Academy's product pages do the same). Renders nothing; it lets a server
 * page report itself without becoming a client component. trackMetaEvent
 * does nothing until the pixel has loaded, so there's no consent to check
 * here.
 *
 * Guarded against firing twice: development runs effects twice on purpose,
 * and a doubled view would quietly inflate the numbers.
 */
export function MetaViewContent({ contentId, contentName }: { contentId: string; contentName: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    // No content_type: Meta only accepts its catalogue values there, and MPE has no catalogue.
    trackMetaEvent("ViewContent", { content_ids: [contentId], content_name: contentName });
  }, [contentId, contentName]);

  return null;
}
