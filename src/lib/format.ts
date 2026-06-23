import type { Drug } from "@/lib/types";

/** Patient/pharmacist-facing label for a resolved drug: "Brand / براند".
 *  Falls back to the raw typed query when nothing matched. */
export function drugLabel(drug: Pick<Drug, "brand_name" | "brand_name_ar"> | null, fallback: string): string {
  if (!drug) return fallback;
  return drug.brand_name_ar ? `${drug.brand_name} / ${drug.brand_name_ar}` : drug.brand_name;
}
