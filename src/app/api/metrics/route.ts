import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isOpsAuthed } from "@/lib/ops-auth";

export const runtime = "nodejs";

// GET /api/metrics — the instrument (playbook Phase 4). Auth-gated.
export async function GET() {
  if (!isOpsAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  await supabase.rpc("expire_open_requests"); // keep stats honest

  const [fillRate, daily, ttc, pharmacies, unmatched] = await Promise.all([
    supabase.from("v_fill_rate").select("*").maybeSingle(),
    supabase.from("v_fill_rate_daily").select("*").limit(14),
    supabase.from("v_time_to_confirm").select("*").maybeSingle(),
    supabase.from("v_pharmacy_responsiveness").select("*").limit(100),
    supabase.from("v_unmatched_requests").select("*").limit(50),
  ]);

  return NextResponse.json({
    fillRate: fillRate.data,
    daily: daily.data ?? [],
    timeToConfirm: ttc.data,
    pharmacies: pharmacies.data ?? [],
    unmatched: unmatched.data ?? [],
  });
}
