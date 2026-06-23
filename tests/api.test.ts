import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseMock, type MockConfig } from "./helpers/supabaseMock";

// --- Hoisted mutable state so module mocks can read per-test config ----------
const h = vi.hoisted(() => ({
  client: null as ReturnType<typeof createSupabaseMock> | null,
  opsAuthed: true,
  pings: [] as unknown[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => h.client,
}));
vi.mock("@/lib/telegram", async (orig) => ({
  ...(await orig<typeof import("@/lib/telegram")>()),
  sendPings: vi.fn(async (...a: unknown[]) => { h.pings.push(a); }),
}));
vi.mock("@/lib/ops-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/ops-auth")>()),
  isOpsAuthed: () => h.opsAuthed,
}));

import { POST as requestPOST } from "@/app/api/request/route";
import { GET as statusGET } from "@/app/api/status/[id]/route";
import { GET as metricsGET } from "@/app/api/metrics/route";
import { POST as loginPOST } from "@/app/api/dashboard-login/route";
import { GET as cronGET } from "@/app/api/cron/expire/route";

function setClient(config: MockConfig) {
  h.client = createSupabaseMock(config);
  return h.client;
}

const DRUG_ROW = {
  id: "d1", brand_name: "Panadol", brand_name_ar: "بانادول",
  generic_name: "Paracetamol", active_ingredient: "Paracetamol",
  strength: "500mg", form: "tablet", search_text: "Panadol بانادول Paracetamol Paracetamol",
};

function postRequest(body: unknown, ip = `ip-${Math.random()}`) {
  return new NextRequest("http://localhost/api/request", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  h.pings = [];
  h.opsAuthed = true;
});

// ---------------------------------------------------------------------------
describe("POST /api/request", () => {
  it("400s on missing fields", async () => {
    setClient({});
    const res = await requestPOST(postRequest({ query: "بانادول" }));
    expect(res.status).toBe(400);
  });

  it("resolves the drug, fans out, pings pharmacies, returns request_id", async () => {
    setClient({
      tables: { drugs: { data: [DRUG_ROW], error: null } },
      rpcs: {
        create_request_and_fanout: {
          data: [
            { request_id: "r1", pharmacy_id: "p1", telegram_chat_id: "100", distance_m: 120 },
            { request_id: "r1", pharmacy_id: "p2", telegram_chat_id: "200", distance_m: 480 },
          ],
          error: null,
        },
      },
    });
    const res = await requestPOST(postRequest({ query: "بانادول", lat: 30, lng: 31 }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.request_id).toBe("r1");
    expect(json.pharmacies_pinged).toBe(2);
    expect(json.drug.brand_name).toBe("Panadol");
    expect(h.pings).toHaveLength(1); // sendPings called once with both targets
  });

  it("succeeds with zero nearby pharmacies (no 500, no pings)", async () => {
    setClient({
      tables: { drugs: { data: [DRUG_ROW], error: null } },
      rpcs: {
        create_request_and_fanout: {
          data: [{ request_id: "r2", pharmacy_id: null, telegram_chat_id: null, distance_m: null }],
          error: null,
        },
      },
    });
    const res = await requestPOST(postRequest({ query: "بانادول", lat: 30, lng: 31 }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.request_id).toBe("r2");
    expect(json.pharmacies_pinged).toBe(0);
    expect(h.pings).toHaveLength(0);
  });

  it("throttles repeated requests from the same IP", async () => {
    setClient({
      tables: { drugs: { data: [DRUG_ROW], error: null } },
      rpcs: { create_request_and_fanout: { data: [{ request_id: "r", pharmacy_id: null, telegram_chat_id: null, distance_m: null }], error: null } },
    });
    const ip = "throttle-test-ip";
    let last;
    for (let i = 0; i < 7; i++) {
      last = await requestPOST(postRequest({ query: "بانادول", lat: 30, lng: 31 }, ip));
    }
    expect(last!.status).toBe(429);
  });

  it("500s when the fan-out RPC errors", async () => {
    setClient({
      tables: { drugs: { data: [DRUG_ROW], error: null } },
      rpcs: { create_request_and_fanout: { data: null, error: { message: "boom" } } },
    });
    const res = await requestPOST(postRequest({ query: "بانادول", lat: 30, lng: 31 }));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
describe("GET /api/status/[id]", () => {
  it("404s for an unknown request", async () => {
    setClient({ tables: { requests: { data: null, error: null } }, rpcs: { expire_open_requests: { data: 0, error: null } } });
    const res = await statusGET(new NextRequest("http://localhost/api/status/x"), { params: { id: "x" } });
    expect(res.status).toBe(404);
  });

  it("returns confirmed match details when matched", async () => {
    setClient({
      rpcs: { expire_open_requests: { data: 0, error: null } },
      tables: {
        requests: { data: { id: "r1", status: "matched", raw_query: "بانادول", created_at: "now", expires_at: "later", drug: { brand_name: "Panadol", brand_name_ar: "بانادول" } }, error: null },
        request_pharmacies: { data: [
          { response: "has_it", price: 25, note: null, responded_at: "t", pharmacy: { name: "صيدلية النور", phone: "0100" } },
          { response: "no_stock", price: null, note: null, responded_at: "t", pharmacy: { name: "صيدلية الشفاء", phone: "0111" } },
        ], error: null },
      },
    });
    const res = await statusGET(new NextRequest("http://localhost/api/status/r1"), { params: { id: "r1" } });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe("matched");
    expect(json.pinged).toBe(2);
    expect(json.responded).toBe(2);
    expect(json.confirmed).toHaveLength(1);
    expect(json.confirmed[0].pharmacy.name).toBe("صيدلية النور");
    expect(json.confirmed[0].price).toBe(25);
  });
});

// ---------------------------------------------------------------------------
describe("GET /api/metrics", () => {
  it("401s when not authed", async () => {
    h.opsAuthed = false;
    setClient({});
    const res = await metricsGET();
    expect(res.status).toBe(401);
  });

  it("returns the metric payload when authed", async () => {
    h.opsAuthed = true;
    setClient({
      rpcs: { expire_open_requests: { data: 0, error: null } },
      tables: {
        v_fill_rate: { data: { matched: 6, resolved: 10, total: 12, fill_rate_pct: 60 }, error: null },
        v_fill_rate_daily: { data: [{ day: "2026-06-23", matched: 6, total: 10, fill_rate_pct: 60 }], error: null },
        v_time_to_confirm: { data: { median_seconds: 90, avg_seconds: 120, confirmed_count: 6 }, error: null },
        v_pharmacy_responsiveness: { data: [], error: null },
        v_unmatched_requests: { data: [], error: null },
      },
    });
    const res = await metricsGET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.fillRate.fill_rate_pct).toBe(60);
    expect(json.daily).toHaveLength(1);
    expect(json.timeToConfirm.confirmed_count).toBe(6);
  });
});

// ---------------------------------------------------------------------------
describe("POST /api/dashboard-login", () => {
  beforeEach(() => { process.env.DASHBOARD_PASSWORD = "secret123"; });

  it("rejects a wrong password", async () => {
    const req = new NextRequest("http://localhost/api/dashboard-login", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "nope" }),
    });
    const res = await loginPOST(req);
    expect(res.status).toBe(401);
  });

  it("accepts the right password and sets the cookie", async () => {
    const req = new NextRequest("http://localhost/api/dashboard-login", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "secret123" }),
    });
    const res = await loginPOST(req);
    expect(res.status).toBe(200);
    expect(res.cookies.get("mf_ops")?.value).toBe("secret123");
  });
});

// ---------------------------------------------------------------------------
describe("GET /api/cron/expire", () => {
  beforeEach(() => { process.env.CRON_SECRET = "cronsecret"; });

  it("401s without the secret", async () => {
    setClient({ rpcs: { expire_open_requests: { data: 3, error: null } } });
    const res = await cronGET(new NextRequest("http://localhost/api/cron/expire"));
    expect(res.status).toBe(401);
  });

  it("runs expiry with a valid Bearer token", async () => {
    setClient({ rpcs: { expire_open_requests: { data: 3, error: null } } });
    const req = new NextRequest("http://localhost/api/cron/expire", { headers: { authorization: "Bearer cronsecret" } });
    const res = await cronGET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.expired).toBe(3);
  });

  it("accepts the secret as a query param too", async () => {
    setClient({ rpcs: { expire_open_requests: { data: 1, error: null } } });
    const res = await cronGET(new NextRequest("http://localhost/api/cron/expire?secret=cronsecret"));
    expect(res.status).toBe(200);
  });
});
