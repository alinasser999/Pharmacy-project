import type { Drug, DrugForm } from "@/lib/search/../types";

// A tiny in-memory catalog mirroring the seed CSV, used for offline matcher
// tests. search_text combines brand (EN+AR) + generic + ingredient, matching
// how the DB generated column is built.
function drug(
  id: string,
  brand_name: string,
  brand_name_ar: string,
  generic_name: string,
  active_ingredient: string,
  strength: string,
  form: DrugForm,
): Drug {
  return {
    id,
    brand_name,
    brand_name_ar,
    generic_name,
    active_ingredient,
    strength,
    form,
    eda_reg_no: null,
    search_text: `${brand_name} ${brand_name_ar} ${generic_name} ${active_ingredient}`,
  };
}

export const CATALOG: Drug[] = [
  drug("1", "Panadol", "بانادول", "Paracetamol", "Paracetamol", "500mg", "tablet"),
  drug("2", "Brufen", "بروفين", "Ibuprofen", "Ibuprofen", "400mg", "tablet"),
  drug("3", "Augmentin", "اوجمنتين", "Amoxicillin/Clavulanate", "Amoxicillin", "1g", "tablet"),
  drug("4", "Cataflam", "كتافلام", "Diclofenac Potassium", "Diclofenac", "50mg", "tablet"),
  drug("5", "Concor", "كونكور", "Bisoprolol", "Bisoprolol", "5mg", "tablet"),
  drug("6", "Telfast", "تلفاست", "Fexofenadine", "Fexofenadine", "180mg", "tablet"),
];
