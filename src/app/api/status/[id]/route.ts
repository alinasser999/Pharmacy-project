import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// GET /api/status/:id — enriched view of a request for the patient screen.
// Uses the service role so we can join pharmacy contact details without
// exposing the pharmacies table publicly.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();

  // Lazily expire if past deadline so the patient sees an honest status.
  await supabase.rpc("expire_open_requests");

  const { data: request, error } = await supabase
    .from("requests")
    .select("id, status, raw_query, created_at, expires_at, drug:drugs(brand_name, brand_name_ar)")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!request) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: responses } = await supabase
    .from("request_pharmacies")
    .select("response, price, note, responded_at, pharmacy:pharmacies(name, phone)")
    .eq("request_id", params.id)
    .order("responded_at", { ascending: true, nullsFirst: false });

  const confirmed = (responses ?? []).filter((r) => r.response === "has_it");

  return NextResponse.json({
    status: request.status,
    drug: request.drug,
    raw_query: request.raw_query,
    pinged: (responses ?? []).length,
    responded: (responses ?? []).filter((r) => r.response).length,
    confirmed: confirmed.map((r) => ({
      pharmacy: r.pharmacy,
      price: r.price,
      note: r.note,
    })),
    alternatives: (responses ?? [])
      .filter((r) => r.response === "has_alternative")
      .map((r) => ({ pharmacy: r.pharmacy, note: r.note })),
  });
}
