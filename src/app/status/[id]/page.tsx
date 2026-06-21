"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Confirmed {
  pharmacy: { name: string; phone: string | null } | null;
  price: number | null;
  note: string | null;
}
interface StatusData {
  status: "open" | "matched" | "expired" | "no_stock";
  drug: { brand_name: string; brand_name_ar: string | null } | null;
  raw_query: string;
  pinged: number;
  responded: number;
  confirmed: Confirmed[];
  alternatives: { pharmacy: { name: string; phone: string | null } | null; note: string | null }[];
}

export default function StatusPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<StatusData | null>(null);

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/status/${params.id}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, [params.id]);

  useEffect(() => {
    refetch();

    // Live updates: subscribe to replies for this request, refetch on change.
    const supabase = createClient();
    const channel = supabase
      .channel(`request-${params.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "request_pharmacies", filter: `request_id=eq.${params.id}` },
        () => refetch(),
      )
      .subscribe();

    // Fallback poll (in case realtime isn't configured yet).
    const poll = setInterval(refetch, 6000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [params.id, refetch]);

  const drugLabel = data?.drug
    ? data.drug.brand_name_ar
      ? `${data.drug.brand_name} (${data.drug.brand_name_ar})`
      : data.drug.brand_name
    : data?.raw_query;

  return (
    <main className="wrap">
      <div className="hero">
        <div className="logo">💊</div>
        <h1>طلبك شغّال</h1>
        {drugLabel && <p>بندوّرلك على: <strong>{drugLabel}</strong></p>}
      </div>

      <div className="card">
        {!data && <p className="empty">بنحمّل حالة طلبك…</p>}

        {data && data.status === "matched" && data.confirmed.length > 0 && (
          <>
            <h3 style={{ color: "var(--green)", marginTop: 0 }}>🎉 لقينالك الدوا!</h3>
            {data.confirmed.map((c, i) => (
              <div className="match" key={i}>
                <h3>{c.pharmacy?.name ?? "صيدلية"}</h3>
                {c.price != null && (
                  <div className="row"><span>السعر</span><span>{c.price} ج.م</span></div>
                )}
                {c.note && <div className="row"><span>ملاحظة</span><span>{c.note}</span></div>}
                {c.pharmacy?.phone && (
                  <a className="call" href={`tel:${c.pharmacy.phone}`}>📞 اتصل بالصيدلية</a>
                )}
              </div>
            ))}
          </>
        )}

        {data && data.status === "open" && (
          <>
            <div className="status-line">
              <span className="dot pulse" />
              <span>بنسأل الصيدليات القريبة منك… ({data.pinged} صيدلية)</span>
            </div>
            <div className="status-line">
              <span className="dot" />
              <span>ردّ علينا {data.responded} لحد دلوقتي</span>
            </div>
            <p className="hint">سيب الصفحة مفتوحة 🌿 أول ما حد يقول «عندي» هنوريك علطول. الطلب بيفضل شغّال ٢٠ دقيقة.</p>
          </>
        )}

        {data && data.status === "no_stock" && (
          <div className="empty">
            😔 الصيدليات القريبة ردّت إن الدوا مش متوفّر دلوقتي.
            {data.alternatives.length > 0 && (
              <div style={{ marginTop: 14, textAlign: "start" }}>
                <strong>في صيدليات عندها بديل ممكن يفيدك:</strong>
                {data.alternatives.map((a, i) => (
                  <div className="match" key={i}>
                    <h3>{a.pharmacy?.name ?? "صيدلية"}</h3>
                    {a.note && <div className="row"><span>البديل</span><span>{a.note}</span></div>}
                    {a.pharmacy?.phone && <a className="call" href={`tel:${a.pharmacy.phone}`}>📞 اتصل</a>}
                  </div>
                ))}
              </div>
            )}
            <p className="hint">جرّب تسأل عن اسم تاني أو دواء بديل، أو كلّم دكتورك.</p>
          </div>
        )}

        {data && data.status === "expired" && (
          <div className="empty">
            ⏰ خلص وقت الطلب من غير ما حد يأكّد إن الدوا موجود.
            <p className="hint">ممكن تبعت الطلب تاني، يمكن صيدلية تكون فتحت دلوقتي.</p>
          </div>
        )}
      </div>

      <a href="/" className="btn-ghost" style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 16, padding: 13, borderRadius: 14 }}>
        🔍 ابحث عن دوا تاني
      </a>
    </main>
  );
}
