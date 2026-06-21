import { describe, it, expect } from "vitest";
import { searchDrug } from "@/lib/search/searchDrug";
import { toPhonetic } from "@/lib/search/normalize";
import { CATALOG } from "./fixtures";

const topBrand = (q: string) => searchDrug(q, CATALOG)[0]?.drug.brand_name;

describe("searchDrug — the Phase 1 test from the playbook", () => {
  it("matches the Arabic spelling بانادول to Panadol", () => {
    expect(topBrand("بانادول")).toBe("Panadol");
  });

  it("matches the English spelling Panadol to Panadol", () => {
    expect(topBrand("Panadol")).toBe("Panadol");
  });

  it("matches the misspelling panadl to Panadol", () => {
    expect(topBrand("panadl")).toBe("Panadol");
  });
});

describe("searchDrug — robustness", () => {
  it("returns at most 5 candidates", () => {
    expect(searchDrug("a", CATALOG).length).toBeLessThanOrEqual(5);
  });

  it("returns empty for an empty query", () => {
    expect(searchDrug("   ", CATALOG)).toEqual([]);
  });

  it("ranks the exact match first with a high score", () => {
    const [best] = searchDrug("Panadol", CATALOG);
    expect(best.drug.brand_name).toBe("Panadol");
    expect(best.score).toBeGreaterThan(0.5);
  });

  it("matches by generic / active ingredient too", () => {
    expect(topBrand("Paracetamol")).toBe("Panadol");
  });

  it("handles a misspelled brand (brufin -> Brufen)", () => {
    expect(topBrand("brufin")).toBe("Brufen");
  });

  it("handles Arabic with diacritics and alef variants", () => {
    expect(topBrand("كونكُور")).toBe("Concor");
  });
});

describe("toPhonetic — normalization", () => {
  it("folds p->b so Arabic transliteration aligns with English brands", () => {
    expect(toPhonetic("Panadol")).toContain("banadol");
  });

  it("transliterates Arabic to a comparable latin key", () => {
    expect(toPhonetic("بانادول")).toContain("banad");
  });
});
