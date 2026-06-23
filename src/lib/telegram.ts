// Server-side Telegram helper: sends a drug-request ping to a pharmacy with
// tap-only inline buttons. Pharmacist copy is warm Egyptian Arabic.

const API = (token: string) => `https://api.telegram.org/bot${token}`;

export interface PingTarget {
  pharmacy_id: string;
  telegram_chat_id: string;
  distance_m: number;
}

function pingText(drugLabel: string, distanceM: number): string {
  return (
    `🔔 حد محتاج دوا قريب منك!\n\n` +
    `💊 الدوا: ${drugLabel}\n` +
    `📍 المسافة: حوالي ${Math.round(distanceM)} متر\n\n` +
    `عندك الدوا ده دلوقتي؟`
  );
}

export type ResponseKind = "has_it" | "no_stock" | "has_alternative";

// callback_data format shared with the bot Edge Function: "<resp>:<req>:<pharm>".
export function buildCallbackData(resp: ResponseKind, requestId: string, pharmacyId: string): string {
  return `${resp}:${requestId}:${pharmacyId}`;
}

export function parseCallbackData(
  data: string,
): { response: ResponseKind; requestId: string; pharmacyId: string } | null {
  const [response, requestId, pharmacyId] = (data ?? "").split(":");
  if (!response || !requestId || !pharmacyId) return null;
  if (response !== "has_it" && response !== "no_stock" && response !== "has_alternative") return null;
  return { response, requestId, pharmacyId };
}

function keyboard(requestId: string, pharmacyId: string) {
  return {
    inline_keyboard: [
      [
        { text: "✅ عندي", callback_data: buildCallbackData("has_it", requestId, pharmacyId) },
        { text: "❌ مش موجود", callback_data: buildCallbackData("no_stock", requestId, pharmacyId) },
      ],
      [{ text: "🔁 عندي بديل", callback_data: buildCallbackData("has_alternative", requestId, pharmacyId) }],
    ],
  };
}

/** Fan out a ping to every nearby pharmacy. Failures are logged, not thrown,
 *  so one bad chat id doesn't sink the whole request. */
export async function sendPings(
  requestId: string,
  drugLabel: string,
  targets: PingTarget[],
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN not set — skipping pings (dev mode).");
    return;
  }

  await Promise.all(
    targets.map(async (t) => {
      try {
        const res = await fetch(`${API(token)}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: t.telegram_chat_id,
            text: pingText(drugLabel, t.distance_m),
            reply_markup: keyboard(requestId, t.pharmacy_id),
          }),
        });
        if (!res.ok) console.error(`ping failed for ${t.telegram_chat_id}: ${res.status}`);
      } catch (e) {
        console.error(`ping error for ${t.telegram_chat_id}`, e);
      }
    }),
  );
}
