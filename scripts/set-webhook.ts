/**
 * Register (or clear) the Telegram webhook for the bot Edge Function.
 *
 *   npx tsx scripts/set-webhook.ts https://<project>.supabase.co/functions/v1/telegram-bot
 *   npx tsx scripts/set-webhook.ts --delete
 *
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from the environment.
 * The secret is appended as ?secret=... so the function can reject forged calls.
 */
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN.");
  process.exit(1);
}

const api = `https://api.telegram.org/bot${token}`;

async function main() {
  if (process.argv[2] === "--delete") {
    const res = await fetch(`${api}/deleteWebhook`, { method: "POST" });
    console.log(await res.json());
    return;
  }

  const base = process.argv[2];
  if (!base) {
    console.error("Usage: tsx scripts/set-webhook.ts <function-url> | --delete");
    process.exit(1);
  }
  if (!secret) {
    console.error("Missing TELEGRAM_WEBHOOK_SECRET (needed to secure the webhook).");
    process.exit(1);
  }

  const url = `${base}?secret=${encodeURIComponent(secret)}`;
  const res = await fetch(`${api}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    }),
  });
  const out = await res.json();
  console.log(out);
  if (!out.ok) process.exit(1);
  console.log(`✅ Webhook set to ${base} (secret hidden).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
