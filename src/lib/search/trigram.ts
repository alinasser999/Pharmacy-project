// A small, dependency-free trigram matcher that mirrors how Postgres pg_trgm
// behaves: pad the string, take 3-char windows, compare sets with similarity.
// We keep our offline matcher behaviorally close to the DB so Phase 1 tests
// reflect production matching.

/** Build the trigram set for a normalized phrase, pg_trgm-style padding. */
export function trigrams(input: string): Set<string> {
  const grams = new Set<string>();
  for (const word of input.split(" ").filter(Boolean)) {
    const padded = `  ${word} `;
    for (let i = 0; i < padded.length - 2; i++) {
      grams.add(padded.slice(i, i + 3));
    }
  }
  return grams;
}

/** Jaccard similarity over trigram sets — same 0..1 range as pg_trgm. */
export function similarity(a: string, b: string): number {
  const ga = trigrams(a);
  const gb = trigrams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter++;
  const union = ga.size + gb.size - inter;
  return union === 0 ? 0 : inter / union;
}
