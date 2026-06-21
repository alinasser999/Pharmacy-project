// MedFinder EG — Telegram bot (Supabase Edge Function, Deno).
//
// Pharmacy-facing side of the loop (playbook Phase 2). Pharmacists interact in
// warm, friendly Egyptian Arabic. UX is tap-only: location share to register,
// inline buttons to reply. No typing, no inventory data — ever.
//
// Deploy:  supabase functions deploy telegram-bot --no-verify-jwt
// Webhook: set with setWebhook to .../functions/v1/telegram-bot?secret=...
//
// @ts-nocheck  (Deno runtime types; this file is excluded from the Next build)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_DISTRICT = Deno.env.get("DEFAULT_DISTRICT") ?? "Maadi";

const API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// --- Warm Arabic copy ----------------------------------------------------
const T = {
  welcome:
    "أهلاً بيك يا دكتور 🌟\n" +
    "إحنا «مِدفايندر» — بنوصّل المريض اللي محتاج دوا بالصيدلية اللي عندها الدوا، علطول.\n\n" +
    "عشان نكمّل تسجيلك، ابعتلنا موقع الصيدلية من الزرار تحت 👇",
  shareLocation: "📍 ابعت موقع الصيدلية",
  askName:
    "تمام كده 🙌 المكان اتسجّل.\n" +
    "بقى اكتبلي اسم الصيدلية بس (مثال: صيدلية النور).",
  registered: (name: string) =>
    `تمام يا دكتور، صيدلية «${name}» اتسجّلت بنجاح ✅\n\n` +
    "من دلوقتي هتوصلك طلبات الدوا من الناس القريبين منك. لما يجيلك طلب، بس دوس على الزرار المناسب — مش هتحتاج تكتب حاجة 🌿\n\n" +
    "شكراً إنك معانا، إنت بتساعد ناس كتير 💚",
  registeredFirstName: "تمام كده 🙌 المكان اتسجّل. بقى اكتبلي اسم الصيدلية.",
  ping: (drug: string, distanceM: number) =>
    `🔔 حد محتاج دوا قريب منك!\n\n` +
    `💊 الدوا: ${drug}\n` +
    `📍 المسافة: حوالي ${Math.round(distanceM)} متر\n\n` +
    `عندك الدوا ده دلوقتي؟`,
  btnHaveIt: "✅ عندي",
  btnNoStock: "❌ مش موجود",
  btnAlt: "🔁 عندي بديل",
  thanksHaveIt:
    "يا سلام عليك 💚 وصّلنا ردّك إن الدوا موجود — المريض هييجي لك حالًا. ربنا يكرمك 🙏",
  thanksNoStock: "تمام، شكراً إنك ردّيت 🌿 ده بيساعدنا نوصّل المريض لحد تاني بسرعة.",
  thanksAlt: "تمام 👍 سجّلنا إن عندك بديل. ممكن المريض يتواصل معاك.",
  alreadyRegistered:
    "صيدليتك مسجّلة معانا بالفعل ✅ سيب التليجرام مفتوح، وأول ما يجيلك طلب هندّيك خبر 🌿",
  notRegistered:
    "لسه ما سجّلتش صيدليتك 🙏 ابعت /start الأول عشان نسجّلك.",
  unknown: "مش فاهم القصد 😅 لو محتاج تسجّل صيدليتك ابعت /start.",
};

async function tg(method: string, body: unknown) {
  await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function locationKeyboard() {
  return {
    keyboard: [[{ text: T.shareLocation, request_location: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

// --- Webhook handler -----------------------------------------------------
Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  const update = await req.json().catch(() => null);
  if (!update) return new Response("ok");

  try {
    if (update.callback_query) await handleCallback(update.callback_query);
    else if (update.message) await handleMessage(update.message);
  } catch (e) {
    console.error("handler error", e);
  }

  return new Response("ok");
});

async function handleMessage(msg: any) {
  const chatId = String(msg.chat.id);
  const text: string = msg.text ?? "";

  // /start -> greet + ask for location
  if (text.startsWith("/start")) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: T.welcome,
      reply_markup: locationKeyboard(),
    });
    return;
  }

  // Location shared -> create/refresh a pending pharmacy row, then ask name
  if (msg.location) {
    const { latitude, longitude } = msg.location;
    await db.from("pharmacies").upsert(
      {
        telegram_chat_id: chatId,
        name: msg.chat.first_name ? `صيدلية ${msg.chat.first_name}` : "صيدلية (بدون اسم)",
        lat: latitude,
        lng: longitude,
        district: DEFAULT_DISTRICT,
        is_active: false, // becomes active once a name is set
      },
      { onConflict: "telegram_chat_id" },
    );
    await tg("sendMessage", { chat_id: chatId, text: T.askName, reply_markup: { remove_keyboard: true } });
    return;
  }

  // Plain text after location -> treat as the pharmacy name, activate.
  // Only while the pharmacy is still pending (is_active = false); otherwise a
  // casual message like "شكرا" would silently rename an active pharmacy.
  if (text && !text.startsWith("/")) {
    const { data: existing } = await db
      .from("pharmacies")
      .select("id, is_active")
      .eq("telegram_chat_id", chatId)
      .maybeSingle();

    if (!existing) {
      await tg("sendMessage", { chat_id: chatId, text: T.notRegistered });
      return;
    }

    if (existing.is_active) {
      await tg("sendMessage", { chat_id: chatId, text: T.alreadyRegistered });
      return;
    }

    await db
      .from("pharmacies")
      .update({ name: text.trim(), is_active: true })
      .eq("telegram_chat_id", chatId);

    await tg("sendMessage", { chat_id: chatId, text: T.registered(text.trim()) });
    return;
  }

  await tg("sendMessage", { chat_id: chatId, text: T.unknown });
}

// callback_data format: "<response>:<request_id>:<pharmacy_id>"
async function handleCallback(cb: any) {
  const chatId = String(cb.message.chat.id);
  const [response, requestId, pharmacyId] = String(cb.data ?? "").split(":");

  if (!response || !requestId || !pharmacyId) {
    await tg("answerCallbackQuery", { callback_query_id: cb.id });
    return;
  }

  await db.rpc("record_response", {
    in_request_id: requestId,
    in_pharmacy_id: pharmacyId,
    in_response: response,
  });

  const ack =
    response === "has_it" ? T.thanksHaveIt :
    response === "no_stock" ? T.thanksNoStock : T.thanksAlt;

  // Acknowledge the tap and replace the buttons with the confirmation text.
  await tg("answerCallbackQuery", { callback_query_id: cb.id });
  await tg("editMessageText", {
    chat_id: chatId,
    message_id: cb.message.message_id,
    text: `${cb.message.text}\n\n${ack}`,
  });
}
