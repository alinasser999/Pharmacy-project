// Text normalization shared by the offline matcher and (conceptually) the
// Postgres pg_trgm pipeline. The goal: make "بانادول", "Panadol", and "panadl"
// all collapse toward the same comparable phonetic form.

const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;

/** Clean and fold Arabic letter variants so spelling differences don't matter. */
export function normalizeArabic(input: string): string {
  return input
    .replace(ARABIC_DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[آأإٱ]/g, "ا") // آأإٱ -> ا
    .replace(/ى/g, "ي") // ى -> ي
    .replace(/ة/g, "ه") // ة -> ه
    .replace(/[ؤ]/g, "و") // ؤ -> و
    .replace(/[ئ]/g, "ي"); // ئ -> ي
}

// Arabic letter -> Latin transliteration, tuned for drug brand names.
const TRANSLIT: Record<string, string> = {
  "ا": "a", "ب": "b", "ت": "t", "ث": "th",
  "ج": "g", "ح": "h", "خ": "kh", "د": "d",
  "ذ": "z", "ر": "r", "ز": "z", "س": "s",
  "ش": "sh", "ص": "s", "ض": "d", "ط": "t",
  "ظ": "z", "ع": "a", "غ": "gh", "ف": "f",
  "ق": "k", "ك": "k", "ل": "l", "م": "m",
  "ن": "n", "ه": "h", "و": "w", "ي": "y",
  "ء": "", "٠": "0", "١": "1", "٢": "2",
  "٣": "3", "٤": "4", "٥": "5", "٦": "6",
  "٧": "7", "٨": "8", "٩": "9",
};

function transliterate(input: string): string {
  const cleaned = normalizeArabic(input);
  let out = "";
  for (const ch of cleaned) out += TRANSLIT[ch] ?? ch;
  return out;
}

const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

/**
 * Reduce any query/term to a comparable phonetic key:
 * lowercase Latin with common Arabic<->English confusions folded
 * (p/b, c/k, v/f) and vowels lightly collapsed so misspellings still align.
 */
export function toPhonetic(input: string): string {
  let s = hasArabic(input) ? transliterate(input) : input;
  s = s.toLowerCase();
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, ""); // strip Latin accents
  s = s
    .replace(/p/g, "b") // Arabic has no /p/; brands swap freely
    .replace(/c/g, "k")
    .replace(/v/g, "f")
    .replace(/ph/g, "f")
    .replace(/(.)\1+/g, "$1"); // collapse doubled letters
  s = s.replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  return s;
}
