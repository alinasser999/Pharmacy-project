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

function keyboard(requestId: string, pharmacyId: string) {
  const cb = (resp: string) => `${resp}:${requestId}:${pharmacyId}`;
  return {
    inline_keyboard: [
      [
        { text: "✅ عندي", callback_data: cb("has_it") },
        { text: "❌ مش موجود", callback_data: cb("no_stock") },
      ],
      [{ text: "🔁 عندي بديل", callback_data: cb("has_alternative") }],
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
