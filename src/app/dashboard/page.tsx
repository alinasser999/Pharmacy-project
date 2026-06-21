"use client";

import { useEffect, useState } from "react";

interface Metrics {
  fillRate: { matched: number; resolved: number; total: number; fill_rate_pct: number | null } | null;
  daily: { day: string; matched: number; total: number; fill_rate_pct: number | null }[];
  timeToConfirm: { median_seconds: number | null; avg_seconds: number | null; confirmed_count: number } | null;
  pharmacies: { name: string; district: string; pinged: number; responded: number; response_rate_pct: number | null; avg_response_seconds: number | null }[];
  unmatched: { raw_query: string; brand_name: string | null; status: string; created_at: string; nearest_district: string | null }[];
}

const fmtSec = (s: number | null | undefined) =>
  s == null ? "—" : s < 90 ? `${Math.round(s)}s` : `${(s / 60).toFixed(1)}m`;

export default function Dashboard() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState<Metrics | null>(null);

  async function load() {
    const res = await fetch("/api/metrics", { cache: "no-store" });
    if (res.status === 401) return setAuthed(false);
    setAuthed(true);
    setData(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function login() {
    setError("");
    const res = await fetch("/api/dashboard-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) return setError("Wrong password.");
    await load();
  }

  if (!authed) {
    return (
      <main style={S.login} dir="ltr">
        <div style={S.loginCard}>
          <h2 style={{ marginTop: 0 }}>MedFinder Ops</h2>
          <p style={{ color: "#78716c", fontSize: 14 }}>Internal dashboard — enter the operator password.</p>
          <input
            style={S.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="Password"
          />
          <button style={S.btn} onClick={login}>Enter</button>
          {error && <p style={{ color: "#dc2626" }}>{error}</p>}
        </div>
      </main>
    );
  }

  const fr = data?.fillRate;
  const ttc = data?.timeToConfirm;

  return (
    <main style={S.page} dir="ltr">
      <h1 style={{ marginBottom: 4 }}>MedFinder EG — Fill Rate</h1>
      <p style={{ color: "#78716c", marginTop: 0 }}>The one number that decides whether this works.</p>

      {/* The fill rate, impossible to miss. */}
      <div style={S.bigCard}>
        <div style={S.bigNum}>{fr?.fill_rate_pct != null ? `${fr.fill_rate_pct}%` : "—"}</div>
        <div style={S.bigLabel}>FILL RATE</div>
        <div style={S.bigSub}>
          {fr ? `${fr.matched} matched / ${fr.resolved} resolved (${fr.total} total)` : "no data yet"}
        </div>
      </div>

      <div style={S.statRow}>
        <Stat label="Median time-to-confirm" value={fmtSec(ttc?.median_seconds)} />
        <Stat label="Avg time-to-confirm" value={fmtSec(ttc?.avg_seconds)} />
        <Stat label="Confirmed total" value={String(ttc?.confirmed_count ?? 0)} />
      </div>

      <Section title="Fill rate by day">
        <Table
          head={["Day", "Matched", "Total", "Fill %"]}
          rows={(data?.daily ?? []).map((d) => [d.day, d.matched, d.total, d.fill_rate_pct ?? "—"])}
          empty="No requests yet."
        />
      </Section>

      <Section title="Pharmacy responsiveness">
        <Table
          head={["Pharmacy", "District", "Pinged", "Responded", "Rate %", "Avg time"]}
          rows={(data?.pharmacies ?? []).map((p) => [
            p.name, p.district, p.pinged, p.responded, p.response_rate_pct ?? "—", fmtSec(p.avg_response_seconds),
          ])}
          empty="No pharmacies yet."
        />
      </Section>

      <Section title="Unmatched requests (the demand we missed)">
        <Table
          head={["Drug / query", "Status", "District", "When"]}
          rows={(data?.unmatched ?? []).map((u) => [
            u.brand_name ?? u.raw_query, u.status, u.nearest_district ?? "—",
            new Date(u.created_at).toLocaleString(),
          ])}
          empty="Nothing unmatched — good."
        />
      </Section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={S.stat}>
      <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#78716c" }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      {children}
    </section>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: (string | number | null)[][]; empty: string }) {
  if (rows.length === 0) return <p style={{ color: "#78716c" }}>{empty}</p>;
  return (
    <table style={S.table}>
      <thead>
        <tr>{head.map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j} style={S.td}>{c ?? "—"}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 880, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif", color: "#1c1917" },
  login: { display: "grid", placeItems: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif" },
  loginCard: { background: "#fff", padding: 28, borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,.1)", width: 320 },
  input: { width: "100%", padding: 12, borderRadius: 10, border: "2px solid #e7e5e4", fontSize: 15, marginBottom: 10 },
  btn: { width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#0f766e", color: "#fff", fontWeight: 700, cursor: "pointer" },
  bigCard: { background: "linear-gradient(135deg,#0f766e,#115e59)", color: "#fff", borderRadius: 20, padding: "32px 24px", textAlign: "center", marginTop: 16 },
  bigNum: { fontSize: 72, fontWeight: 900, lineHeight: 1 },
  bigLabel: { fontSize: 14, letterSpacing: 2, opacity: 0.9, marginTop: 8 },
  bigSub: { fontSize: 13, opacity: 0.8, marginTop: 6 },
  statRow: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 16 },
  stat: { background: "#fff", borderRadius: 14, padding: 16, textAlign: "center", boxShadow: "0 4px 14px rgba(0,0,0,.05)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e7e5e4", color: "#78716c", fontWeight: 600 },
  td: { padding: "8px 10px", borderBottom: "1px solid #f5f5f4" },
};
