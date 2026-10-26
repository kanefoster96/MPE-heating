"use client";

import { useEffect } from "react";

/** On a phone, opens the app straight away (a computer would just show an error, so it's left to the button there). */
export function OpenApp({ url }: { url: string }) {
  useEffect(() => {
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) window.location.href = url;
  }, [url]);
  return null;
}
