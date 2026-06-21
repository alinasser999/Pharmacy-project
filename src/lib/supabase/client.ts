"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser client — used by the patient page to subscribe to Realtime updates.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
