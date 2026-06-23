// Generates a larger, normalized Egyptian-market drug catalog as CSV.
//   node scripts/generate-catalog.mjs > supabase/seed/drugs.egypt.csv
//   (or) npm run catalog
//
// Source: common brands stocked in Egyptian community pharmacies, with their
// active ingredient, a typical OTC strength, and dosage form. This is a
// "good enough to match common drugs" seed (playbook Phase 1), not a complete
// EDA register — extend it from an EDA export when you have one.
//
// Columns match the seed loader: brand_name, brand_name_ar, generic_name,
// active_ingredient, strength, form, eda_reg_no.

import { writeFileSync } from "node:fs";

// [brand_en, brand_ar, generic, active_ingredient, strength, form]
const D = [
  // --- Analgesics / antipyretics / NSAIDs ---
  ["Panadol", "بانادول", "Paracetamol", "Paracetamol", "500mg", "tablet"],
  ["Panadol Extra", "بانادول إكسترا", "Paracetamol + Caffeine", "Paracetamol", "500mg", "tablet"],
  ["Adol", "أدول", "Paracetamol", "Paracetamol", "500mg", "tablet"],
  ["Cetal", "سيتال", "Paracetamol", "Paracetamol", "500mg", "tablet"],
  ["Abimol", "أبيمول", "Paracetamol", "Paracetamol", "500mg", "tablet"],
  ["Paramol", "بارامول", "Paracetamol", "Paracetamol", "500mg", "tablet"],
  ["Cetal Syrup", "سيتال شراب", "Paracetamol", "Paracetamol", "120mg/5ml", "syrup"],
  ["Brufen", "بروفين", "Ibuprofen", "Ibuprofen", "400mg", "tablet"],
  ["Brufen Syrup", "بروفين شراب", "Ibuprofen", "Ibuprofen", "100mg/5ml", "syrup"],
  ["Cataflam", "كتافلام", "Diclofenac Potassium", "Diclofenac", "50mg", "tablet"],
  ["Voltaren", "فولتارين", "Diclofenac Sodium", "Diclofenac", "50mg", "tablet"],
  ["Olfen", "أولفين", "Diclofenac Sodium", "Diclofenac", "100mg", "capsule"],
  ["Declophen", "ديكلوفين", "Diclofenac Sodium", "Diclofenac", "50mg", "tablet"],
  ["Ketofan", "كيتوفان", "Ketoprofen", "Ketoprofen", "100mg", "tablet"],
  ["Profenid", "بروفينيد", "Ketoprofen", "Ketoprofen", "100mg", "tablet"],
  ["Mobic", "موبيك", "Meloxicam", "Meloxicam", "15mg", "tablet"],
  ["Celebrex", "سيليبركس", "Celecoxib", "Celecoxib", "200mg", "capsule"],
  ["Novalgin", "نوفالجين", "Metamizole", "Dipyrone", "500mg", "tablet"],
  ["Rivo", "ريفو", "Acetylsalicylic Acid", "Aspirin", "320mg", "tablet"],
  ["Aspocid", "أسبوسيد", "Acetylsalicylic Acid", "Aspirin", "75mg", "tablet"],
  ["Myofen", "ميوفين", "Ibuprofen", "Ibuprofen", "400mg", "tablet"],
  ["Dolphin", "دولفين", "Diclofenac + B vitamins", "Diclofenac", "50mg", "tablet"],
  ["Tramal", "ترامال", "Tramadol", "Tramadol", "50mg", "capsule"],
  ["Alphintern", "ألفينترن", "Trypsin + Chymotrypsin", "Chymotrypsin", "-", "tablet"],

  // --- Antibiotics ---
  ["Augmentin", "أوجمنتين", "Amoxicillin + Clavulanate", "Amoxicillin", "1g", "tablet"],
  ["Megamox", "ميجاموكس", "Amoxicillin + Clavulanate", "Amoxicillin", "1g", "tablet"],
  ["Hibiotic", "هاي بيوتيك", "Amoxicillin + Clavulanate", "Amoxicillin", "1g", "tablet"],
  ["Curam", "كيورام", "Amoxicillin + Clavulanate", "Amoxicillin", "1g", "tablet"],
  ["E-Mox", "إي-موكس", "Amoxicillin", "Amoxicillin", "500mg", "capsule"],
  ["Amoxil", "أموكسيل", "Amoxicillin", "Amoxicillin", "500mg", "capsule"],
  ["Unictam", "يونيكتام", "Sultamicillin (Ampicillin+Sulbactam)", "Sultamicillin", "375mg", "tablet"],
  ["Velosef", "فيلوسيف", "Cephradine", "Cephradine", "500mg", "capsule"],
  ["Keflex", "كيفلكس", "Cephalexin", "Cephalexin", "500mg", "capsule"],
  ["Zinnat", "زينات", "Cefuroxime", "Cefuroxime", "500mg", "tablet"],
  ["Ceftrex", "سيفتركس", "Ceftriaxone", "Ceftriaxone", "1g", "injection"],
  ["Cipro", "سيبرو", "Ciprofloxacin", "Ciprofloxacin", "500mg", "tablet"],
  ["Ciprocin", "سيبروسين", "Ciprofloxacin", "Ciprofloxacin", "500mg", "tablet"],
  ["Tavanic", "تافانيك", "Levofloxacin", "Levofloxacin", "500mg", "tablet"],
  ["Klacid", "كلاسيد", "Clarithromycin", "Clarithromycin", "500mg", "tablet"],
  ["Zithromax", "زيثروماكس", "Azithromycin", "Azithromycin", "500mg", "tablet"],
  ["Zisrocin", "زيسروسين", "Azithromycin", "Azithromycin", "500mg", "tablet"],
  ["Flagyl", "فلاجيل", "Metronidazole", "Metronidazole", "500mg", "tablet"],
  ["Amrizole", "أمريزول", "Metronidazole", "Metronidazole", "500mg", "tablet"],
  ["Doxymycin", "دوكسيميسين", "Doxycycline", "Doxycycline", "100mg", "capsule"],
  ["Septrin", "سبترين", "Sulfamethoxazole + Trimethoprim", "Co-trimoxazole", "480mg", "tablet"],

  // --- GIT ---
  ["Antinal", "أنتينال", "Nifuroxazide", "Nifuroxazide", "200mg", "capsule"],
  ["Streptoquin", "ستربتوكين", "Diiodohydroxyquinoline + Streptomycin", "Streptoquin", "-", "tablet"],
  ["Smecta", "سميكتا", "Diosmectite", "Diosmectite", "3g", "other"],
  ["Buscopan", "بوسكوبان", "Hyoscine Butylbromide", "Hyoscine", "10mg", "tablet"],
  ["Spasmo-Digestin", "سبازمو دايجستين", "Dimethylpolysiloxane + Enzymes", "Pancreatin", "-", "tablet"],
  ["Motilium", "موتيليوم", "Domperidone", "Domperidone", "10mg", "tablet"],
  ["Primperan", "بريمبران", "Metoclopramide", "Metoclopramide", "10mg", "tablet"],
  ["Nexium", "نيكسيوم", "Esomeprazole", "Esomeprazole", "40mg", "tablet"],
  ["Omez", "أوميز", "Omeprazole", "Omeprazole", "20mg", "capsule"],
  ["Risek", "ريسك", "Omeprazole", "Omeprazole", "20mg", "capsule"],
  ["Controloc", "كونترولوك", "Pantoprazole", "Pantoprazole", "40mg", "tablet"],
  ["Gaviscon", "جافيسكون", "Sodium Alginate", "Alginate", "-", "syrup"],
  ["Maalox", "مالوكس", "Aluminium + Magnesium Hydroxide", "Antacid", "-", "syrup"],
  ["Duphalac", "دوفالاك", "Lactulose", "Lactulose", "-", "syrup"],

  // --- Cardiovascular / metabolic ---
  ["Concor", "كونكور", "Bisoprolol", "Bisoprolol", "5mg", "tablet"],
  ["Inderal", "إندرال", "Propranolol", "Propranolol", "40mg", "tablet"],
  ["Tenormin", "تينورمين", "Atenolol", "Atenolol", "50mg", "tablet"],
  ["Betaloc", "بيتالوك", "Metoprolol", "Metoprolol", "50mg", "tablet"],
  ["Norvasc", "نورفاسك", "Amlodipine", "Amlodipine", "5mg", "tablet"],
  ["Amlor", "أملور", "Amlodipine", "Amlodipine", "5mg", "tablet"],
  ["Capoten", "كابوتين", "Captopril", "Captopril", "25mg", "tablet"],
  ["Zestril", "زيستريل", "Lisinopril", "Lisinopril", "10mg", "tablet"],
  ["Tritace", "تريتاس", "Ramipril", "Ramipril", "5mg", "tablet"],
  ["Coversyl", "كوفرسيل", "Perindopril", "Perindopril", "5mg", "tablet"],
  ["Tareg", "تاريج", "Valsartan", "Valsartan", "80mg", "tablet"],
  ["Co-Diovan", "كو ديوفان", "Valsartan + HCTZ", "Valsartan", "160mg", "tablet"],
  ["Exforge", "إكسفورج", "Amlodipine + Valsartan", "Amlodipine", "5/80mg", "tablet"],
  ["Natrilix", "ناتريلكس", "Indapamide", "Indapamide", "1.5mg", "tablet"],
  ["Lasix", "لازكس", "Furosemide", "Furosemide", "40mg", "tablet"],
  ["Aldactone", "ألداكتون", "Spironolactone", "Spironolactone", "25mg", "tablet"],
  ["Vastarel", "فاستاريل", "Trimetazidine", "Trimetazidine", "35mg", "tablet"],
  ["Plavix", "بلافيكس", "Clopidogrel", "Clopidogrel", "75mg", "tablet"],
  ["Lipitor", "ليبيتور", "Atorvastatin", "Atorvastatin", "20mg", "tablet"],
  ["Crestor", "كريستور", "Rosuvastatin", "Rosuvastatin", "10mg", "tablet"],
  ["Atoreza", "أتوريزا", "Atorvastatin", "Atorvastatin", "20mg", "tablet"],
  ["Cordarone", "كوردارون", "Amiodarone", "Amiodarone", "200mg", "tablet"],
  ["Clexane", "كليكسان", "Enoxaparin", "Enoxaparin", "40mg", "injection"],

  // --- Diabetes ---
  ["Glucophage", "جلوكوفاج", "Metformin", "Metformin", "500mg", "tablet"],
  ["Cidophage", "سيدوفاج", "Metformin", "Metformin", "850mg", "tablet"],
  ["Amaryl", "أماريل", "Glimepiride", "Glimepiride", "2mg", "tablet"],
  ["Diamicron", "دياميكرون", "Gliclazide", "Gliclazide", "60mg", "tablet"],
  ["Januvia", "جانوفيا", "Sitagliptin", "Sitagliptin", "100mg", "tablet"],
  ["Galvus", "جالفس", "Vildagliptin", "Vildagliptin", "50mg", "tablet"],
  ["Insulin Mixtard", "إنسولين ميكستارد", "Insulin (biphasic)", "Insulin", "100IU/ml", "injection"],
  ["Lantus", "لانتوس", "Insulin Glargine", "Insulin", "100IU/ml", "injection"],

  // --- Respiratory / allergy / cold ---
  ["Congestal", "كونجستال", "Paracetamol + Pseudoephedrine + Chlorpheniramine", "Paracetamol", "-", "tablet"],
  ["Comtrex", "كومتركس", "Paracetamol + Chlorpheniramine + Pseudoephedrine", "Paracetamol", "-", "tablet"],
  ["Coldfree", "كولدفري", "Paracetamol + Phenylephrine", "Paracetamol", "-", "tablet"],
  ["Telfast", "تلفاست", "Fexofenadine", "Fexofenadine", "180mg", "tablet"],
  ["Claritine", "كلاريتين", "Loratadine", "Loratadine", "10mg", "tablet"],
  ["Zyrtec", "زيرتك", "Cetirizine", "Cetirizine", "10mg", "tablet"],
  ["Aerius", "إيريوس", "Desloratadine", "Desloratadine", "5mg", "tablet"],
  ["Allergyl", "أليرجيل", "Chlorpheniramine", "Chlorpheniramine", "4mg", "tablet"],
  ["Ventolin", "فنتولين", "Salbutamol", "Salbutamol", "100mcg", "inhaler"],
  ["Ventolin Syrup", "فنتولين شراب", "Salbutamol", "Salbutamol", "2mg/5ml", "syrup"],
  ["Symbicort", "سيمبيكورت", "Budesonide + Formoterol", "Budesonide", "-", "inhaler"],
  ["Flixotide", "فليكسوتيد", "Fluticasone", "Fluticasone", "125mcg", "inhaler"],
  ["Nasivin", "نازيفين", "Oxymetazoline", "Oxymetazoline", "0.05%", "drops"],
  ["Otrivin", "أوتريفين", "Xylometazoline", "Xylometazoline", "0.1%", "drops"],
  ["Farcosolvin", "فاركوسولفين", "Ambroxol", "Ambroxol", "30mg", "syrup"],
  ["Mucosolvan", "ميوكوسولفان", "Ambroxol", "Ambroxol", "30mg", "syrup"],

  // --- CNS / psych / neuro ---
  ["Xanax", "زاناكس", "Alprazolam", "Alprazolam", "0.5mg", "tablet"],
  ["Lexotanil", "ليكسوتانيل", "Bromazepam", "Bromazepam", "3mg", "tablet"],
  ["Prozac", "بروزاك", "Fluoxetine", "Fluoxetine", "20mg", "capsule"],
  ["Cipralex", "سيبرالكس", "Escitalopram", "Escitalopram", "10mg", "tablet"],
  ["Tegretol", "تيجريتول", "Carbamazepine", "Carbamazepine", "200mg", "tablet"],
  ["Depakine", "ديباكين", "Sodium Valproate", "Valproate", "500mg", "tablet"],
  ["Epanutin", "إيبانوتين", "Phenytoin", "Phenytoin", "100mg", "capsule"],
  ["Neurontin", "نيورونتين", "Gabapentin", "Gabapentin", "300mg", "capsule"],
  ["Lyrica", "ليريكا", "Pregabalin", "Pregabalin", "75mg", "capsule"],

  // --- Topical / eye / ENT ---
  ["Fucidin", "فيوسيدين", "Fusidic Acid", "Fusidic Acid", "2%", "cream"],
  ["Daktarin", "داكتارين", "Miconazole", "Miconazole", "2%", "cream"],
  ["Canesten", "كانيستين", "Clotrimazole", "Clotrimazole", "1%", "cream"],
  ["Voltaren Emulgel", "فولتارين جل", "Diclofenac", "Diclofenac", "1%", "cream"],
  ["Tobrex", "توبريكس", "Tobramycin", "Tobramycin", "0.3%", "drops"],
  ["Tobradex", "توبرادكس", "Tobramycin + Dexamethasone", "Tobramycin", "-", "drops"],
  ["Optipred", "أوبتيبريد", "Prednisolone", "Prednisolone", "1%", "drops"],

  // --- Vitamins / supplements / women & child ---
  ["Cac-1000", "كال سي 1000", "Calcium + Vitamin C", "Calcium", "1000mg", "other"],
  ["Ossofortin", "أوسوفورتين", "Calcium + Vitamin D3", "Calcium", "-", "tablet"],
  ["Centrum", "سنتروم", "Multivitamin + Minerals", "Multivitamin", "-", "tablet"],
  ["Vidrop", "فيدروب", "Vitamin D3", "Cholecalciferol", "-", "drops"],
  ["Ferrofol", "فيروفول", "Iron + Folic Acid", "Ferrous", "-", "capsule"],
  ["Haemoton", "هيموتون", "Iron + Vitamins", "Ferrous", "-", "syrup"],
  ["Folic Acid", "حمض الفوليك", "Folic Acid", "Folic Acid", "5mg", "tablet"],
  ["Insulin NovoRapid", "إنسولين نوفورابيد", "Insulin Aspart", "Insulin", "100IU/ml", "injection"],
  ["Cortiplex", "كورتيبلكس", "Vitamin B complex", "Vitamin B", "-", "tablet"],
  ["Neurorubine", "نيوروبين", "Vitamin B1 B6 B12", "Vitamin B", "-", "tablet"],
];

const header = "brand_name,brand_name_ar,generic_name,active_ingredient,strength,form,eda_reg_no";

function csvField(v) {
  // Quote fields containing commas/quotes; escape inner quotes.
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

const lines = [header];
const seen = new Set();
for (const [brand, ar, generic, ingredient, strength, form] of D) {
  const key = `${brand}|${strength}`.toLowerCase();
  if (seen.has(key)) {
    console.error(`Duplicate skipped: ${brand} ${strength}`);
    continue;
  }
  seen.add(key);
  lines.push([brand, ar, generic, ingredient, strength, form, ""].map(csvField).join(","));
}

const out = lines.join("\n") + "\n";
const target = new URL("../supabase/seed/drugs.egypt.csv", import.meta.url);
writeFileSync(target, out, "utf8");
console.error(`Wrote ${D.length} drugs -> supabase/seed/drugs.egypt.csv`);
