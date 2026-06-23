import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { searchDrug } from "@/lib/search/searchDrug";
import { sendPings, type PingTarget } from "@/lib/telegram";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { drugLabel } from "@/lib/format";
import type { Drug } from "@/lib/types";

export const runtime = "nodejs";

const RADIUS_KM = Number(process.env.SEARCH_RADIUS_KM ?? 2);
const TTL_MIN = Number(process.env.REQUEST_TTL_MINUTES ?? 20);
const RATE_LIMIT = Number(process.env.REQUEST_RATE_LIMIT ?? 5);

// POST /api/request — the core loop (playbook Phase 3).
// Body: { query: string, lat: number, lng: number, contact: string }
export async function POST(req: NextRequest) {
  // Throttle per client to prevent ping spam / pharmacy ping-fatigue.
  const limit = rateLimit(`req:${clientIp(req.headers)}`, RATE_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "بعتّ طلبات كتير في وقت قصير 🙏 استنى شويّة وجرّب تاني." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.query !== "string" || typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1) Resolve the drug with the TS fuzzy matcher over the catalog.
  const { data: catalog, error: catErr } = await supabase
    .from("drugs")
    .select("id, brand_name, brand_name_ar, generic_name, active_ingredient, strength, form, search_text");
  if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 });

  const matches = searchDrug(body.query, (catalog ?? []) as unknown as Drug[]);
  const top = matches[0]?.drug ?? null;
  const label = drugLabel(top, body.query);

  // 2) + 3) Create the request and fan out to nearby pharmacies in one call.
  const { data: fanout, error: rpcErr } = await supabase.rpc("create_request_and_fanout", {
    in_drug_id: top?.id ?? null,
    in_raw_query: body.query,
    in_patient_contact: typeof body.contact === "string" && body.contact ? body.contact : crypto.randomUUID(),
    in_lat: body.lat,
    in_lng: body.lng,
    in_radius_km: RADIUS_KM,
    in_ttl_minutes: TTL_MIN,
  });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });

  const rows = (fanout ?? []) as Array<{
    request_id: string; pharmacy_id: string; telegram_chat_id: string; distance_m: number;
  }>;
  const requestId = rows[0]?.request_id ?? null;

  if (!requestId) {
    return NextResponse.json({ error: "no_request" }, { status: 500 });
  }

  // 4) Ping each pharmacy via Telegram.
  const targets: PingTarget[] = rows
    .filter((r) => r.telegram_chat_id)
    .map((r) => ({ pharmacy_id: r.pharmacy_id, telegram_chat_id: r.telegram_chat_id, distance_m: r.distance_m }));
  if (targets.length) await sendPings(requestId, label, targets);

  return NextResponse.json({
    request_id: requestId,
    drug: top ? { brand_name: top.brand_name, brand_name_ar: top.brand_name_ar } : null,
    pharmacies_pinged: targets.length,
  });
}
