import type { Drug, DrugMatch } from "@/lib/types";
import { toPhonetic } from "./normalize";
import { similarity } from "./trigram";

// Minimum trigram similarity to consider a candidate at all. Tuned so common
// misspellings ("panadl") still clear the bar while noise is rejected.
const MIN_SCORE = 0.18;

/**
 * Pure, offline drug matcher used by Phase 1 tests and as a fallback.
 * In production, the same query is also resolved by the Postgres `search_drugs`
 * RPC (pg_trgm); both share the normalization in ./normalize so they agree.
 *
 * Scores each candidate's individual terms (brand / generic / ingredient) and
 * keeps the best, so a strong hit on the brand isn't diluted by a long
 * search_text.
 */
export function matchDrugs(query: string, catalog: Drug[], limit = 5): DrugMatch[] {
  const q = toPhonetic(query);
  if (!q) return [];

  const matches: DrugMatch[] = [];
  for (const drug of catalog) {
    const terms = [drug.brand_name, drug.generic_name, drug.active_ingredient, drug.search_text]
      .filter(Boolean)
      .map((t) => toPhonetic(t as string));

    let best = 0;
    for (const term of terms) best = Math.max(best, similarity(q, term));

    if (best >= MIN_SCORE) matches.push({ drug, score: best });
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * searchDrug(query) — resolves a typed query (Arabic or English, possibly
 * misspelled) to the top 5 drug candidates.
 *
 * Pass a catalog to run fully offline (tests). Omit it and the caller is
 * expected to use the Supabase RPC variant in `searchDrugRpc`.
 */
export function searchDrug(query: string, catalog: Drug[], limit = 5): DrugMatch[] {
  return matchDrugs(query, catalog, limit);
}
