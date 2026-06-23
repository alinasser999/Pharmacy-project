import { describe, it, expect } from "vitest";
import { searchDrug } from "@/lib/search/searchDrug";
import { loadEgyptCatalog } from "./loadCatalog";

const CATALOG = loadEgyptCatalog();
const top = (q: string) => searchDrug(q, CATALOG)[0]?.drug.brand_name;

describe("Egypt catalog — integrity", () => {
  it("loads a substantial catalog", () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(120);
  });

  it("every row has the required fields", () => {
    for (const d of CATALOG) {
      expect(d.brand_name, JSON.stringify(d)).toBeTruthy();
      expect(d.active_ingredient, JSON.stringify(d)).toBeTruthy();
      expect(d.brand_name_ar, `${d.brand_name} missing Arabic`).toBeTruthy();
    }
  });

  it("uses only valid dosage forms", () => {
    const valid = new Set(["tablet", "syrup", "capsule", "cream", "drops", "injection", "inhaler", "other"]);
    for (const d of CATALOG) expect(valid.has(d.form), `${d.brand_name}: ${d.form}`).toBe(true);
  });

  it("has no duplicate brand+strength", () => {
    const seen = new Set<string>();
    for (const d of CATALOG) {
      const key = `${d.brand_name}|${d.strength}`.toLowerCase();
      expect(seen.has(key), `duplicate ${key}`).toBe(false);
      seen.add(key);
    }
  });
});

describe("Egypt catalog — English brand matching", () => {
  const cases: [string, string][] = [
    ["Augmentin", "Augmentin"],
    ["Concor", "Concor"],
    ["Glucophage", "Glucophage"],
    ["Nexium", "Nexium"],
    ["Telfast", "Telfast"],
    ["Cataflam", "Cataflam"],
    ["Ventolin", "Ventolin"],
    ["Lyrica", "Lyrica"],
    ["Plavix", "Plavix"],
    ["Zyrtec", "Zyrtec"],
  ];
  it.each(cases)("%s -> %s", (q, brand) => {
    expect(top(q)).toBe(brand);
  });
});

describe("Egypt catalog — Arabic brand matching", () => {
  const cases: [string, string][] = [
    ["بانادول", "Panadol"],
    ["أوجمنتين", "Augmentin"],
    ["كونكور", "Concor"],
    ["كتافلام", "Cataflam"],
    ["فلاجيل", "Flagyl"],
    ["نيكسيوم", "Nexium"],
    ["فنتولين", "Ventolin"],
    ["كلاريتين", "Claritine"],
    ["جلوكوفاج", "Glucophage"],
  ];
  it.each(cases)("%s -> %s", (q, brand) => {
    expect(top(q)).toBe(brand);
  });
});

describe("Egypt catalog — misspellings still resolve", () => {
  const cases: [string, string][] = [
    ["panadl", "Panadol"],
    ["augmentn", "Augmentin"],
    ["brufin", "Brufen"],
    ["kataflam", "Cataflam"],
    ["glucofage", "Glucophage"],
    ["ventoline", "Ventolin"],
    ["nexum", "Nexium"],
  ];
  it.each(cases)("%s -> %s", (q, brand) => {
    expect(top(q)).toBe(brand);
  });
});

describe("Egypt catalog — generic / ingredient search returns a relevant brand", () => {
  it("Paracetamol returns a paracetamol brand", () => {
    const r = searchDrug("Paracetamol", CATALOG)[0];
    expect(r.drug.active_ingredient).toBe("Paracetamol");
  });
  it("Amoxicillin returns an amoxicillin brand", () => {
    const r = searchDrug("Amoxicillin", CATALOG)[0];
    expect(r.drug.active_ingredient).toBe("Amoxicillin");
  });
  it("Metformin returns a metformin brand", () => {
    const r = searchDrug("Metformin", CATALOG)[0];
    expect(r.drug.active_ingredient).toBe("Metformin");
  });
});

describe("Egypt catalog — non-drug noise returns nothing absurd", () => {
  it("gibberish yields no high-confidence match", () => {
    const r = searchDrug("zzzqqqxx", CATALOG);
    expect(r.length === 0 || r[0].score < 0.3).toBe(true);
  });
});
