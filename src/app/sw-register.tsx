"use client";

import { useEffect } from "react";

// Registers the service worker once on the client. Kept tiny and side-effect
// only so the rest of the app stays server-rendered.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration is best-effort; the app works without it */
    });
  }, []);
  return null;
}
