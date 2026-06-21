// Shared domain types — mirror the data model in the playbook (Part 3).

export type DrugForm = "tablet" | "syrup" | "capsule" | "cream" | "drops" | "injection" | "other";

export interface Drug {
  id: string;
  active_ingredient: string;
  brand_name: string;
  brand_name_ar: string | null;
  generic_name: string | null;
  strength: string | null;
  form: DrugForm;
  eda_reg_no: string | null;
  /** Generated: brand + generic + ingredient (+ Arabic), feeds the trigram index. */
  search_text: string;
}

export interface DrugMatch {
  drug: Drug;
  score: number; // 0..1 trigram similarity
}

export type RequestStatus = "open" | "matched" | "expired" | "no_stock";

export interface MedRequest {
  id: string;
  drug_id: string | null;
  raw_query: string;
  patient_contact: string;
  lat: number;
  lng: number;
  status: RequestStatus;
  created_at: string;
  expires_at: string;
}

export type PharmacyResponse = "has_it" | "no_stock" | "has_alternative";

export interface RequestPharmacy {
  id: string;
  request_id: string;
  pharmacy_id: string;
  pinged_at: string;
  response: PharmacyResponse | null;
  responded_at: string | null;
  price: number | null;
  note: string | null;
}

export interface Pharmacy {
  id: string;
  name: string;
  phone: string | null;
  telegram_chat_id: string;
  lat: number;
  lng: number;
  district: string;
  is_active: boolean;
  joined_at: string;
  responsiveness_score: number | null;
}
