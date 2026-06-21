"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function getLocation() {
    setLocStatus("loading");
    setError("");
    if (!navigator.geolocation) {
      setLocStatus("error");
      setError("جهازك مش بيدعم تحديد الموقع. جرّب من موبايل تاني.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("ok");
      },
      () => {
        setLocStatus("error");
        setError("مقدرناش نجيب موقعك. اتأكد إنك سامح للموقع وجرّب تاني.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit() {
    setError("");
    if (!query.trim()) return setError("اكتب اسم الدوا الأول 🙏");
    if (!coords) return setError("محتاجين موقعك عشان نلاقيلك أقرب صيدلية 📍");

    setSubmitting(true);
    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: query.trim(), lat: coords.lat, lng: coords.lng }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "حصل خطأ");
      router.push(`/status/${data.request_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حصل خطأ، جرّب تاني.");
      setSubmitting(false);
    }
  }

  return (
    <main className="wrap">
      <div className="hero">
        <div className="logo">💊</div>
        <h1>لاقي دواك بسرعة</h1>
        <p>اكتب اسم الدوا، واحنا نسأل الصيدليات القريبة منك ونرجّعلك مين عنده الدوا. ببلاش وفي دقايق 🌿</p>
      </div>

      <div className="card">
        <label htmlFor="drug">اسم الدوا</label>
        <input
          id="drug"
          type="text"
          placeholder="مثال: بانادول، Augmentin، كتافلام…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <label>موقعك</label>
        {locStatus === "ok" ? (
          <p className="loc-ok">📍 تمام، موقعك اتحدّد ✅</p>
        ) : (
          <button className="btn-ghost" onClick={getLocation} disabled={locStatus === "loading"}>
            {locStatus === "loading" ? "بنحدّد موقعك…" : "📍 حدّد موقعي"}
          </button>
        )}
        <p className="hint">بنستخدم موقعك بس عشان نلاقي أقرب صيدلية ليك. مش بنحفظ أي بيانات شخصية.</p>

        <button className="btn-primary" onClick={submit} disabled={submitting}>
          {submitting ? "بنبعت طلبك…" : "ابعت الطلب 🚀"}
        </button>

        {error && <p className="error">{error}</p>}
      </div>

      <p className="footer">
        إحنا مش صيدلية — إحنا بنوصّلك بالصيدليات القريبة بس 💚<br />
        للأدوية المزمنة أو الروشتة، كلّم دكتورك.
      </p>
    </main>
  );
}
