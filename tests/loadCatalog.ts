import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import type { Drug, DrugForm } from "@/lib/types";

// Loads the generated Egypt catalog and builds Drug[] with search_text the same
// way the DB generated column does (brand EN + brand AR + generic + ingredient).
export function loadEgyptCatalog(): Drug[] {
  const csvPath = resolve(__dirname, "../supabase/seed/drugs.egypt.csv");
  const rows = parse(readFileSync(csvPath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  return rows.map((r, i) => ({
    id: String(i + 1),
    brand_name: r.brand_name,
    brand_name_ar: r.brand_name_ar || null,
    generic_name: r.generic_name || null,
    active_ingredient: r.active_ingredient,
    strength: r.strength || null,
    form: (r.form || "other") as DrugForm,
    eda_reg_no: r.eda_reg_no || null,
    search_text: `${r.brand_name} ${r.brand_name_ar} ${r.generic_name} ${r.active_ingredient}`,
  }));
}
