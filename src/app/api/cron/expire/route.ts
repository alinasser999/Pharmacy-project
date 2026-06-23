import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/cron/expire — flips past-deadline open requests to 'expired' so the
// fill-rate denominator stays honest even if no one opens a page.
//
// Scheduled by vercel.json (every minute). Protected by CRON_SECRET: Vercel
// Cron sends "Authorization: Bearer <CRON_SECRET>" automatically when the env
// var is set; we also accept "?secret=" for manual/other schedulers.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const qp = req.nextUrl.searchParams.get("secret");
    if (auth !== `Bearer ${secret}` && qp !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("expire_open_requests");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ expired: data ?? 0 });
}
