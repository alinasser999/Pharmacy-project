import { describe, it, expect } from "vitest";
import { buildCallbackData, parseCallbackData } from "@/lib/telegram";
import { drugLabel } from "@/lib/format";

describe("callback_data round-trip", () => {
  it("builds and parses back the same values", () => {
    const data = buildCallbackData("has_it", "req-1", "ph-9");
    expect(data).toBe("has_it:req-1:ph-9");
    expect(parseCallbackData(data)).toEqual({
      response: "has_it",
      requestId: "req-1",
      pharmacyId: "ph-9",
    });
  });

  it("rejects malformed or unknown payloads", () => {
    expect(parseCallbackData("")).toBeNull();
    expect(parseCallbackData("has_it")).toBeNull();
    expect(parseCallbackData("has_it:only-two")).toBeNull();
    expect(parseCallbackData("bogus:req:ph")).toBeNull();
  });
});

describe("drugLabel", () => {
  it("shows brand + Arabic brand when available", () => {
    expect(drugLabel({ brand_name: "Panadol", brand_name_ar: "بانادول" }, "x")).toBe("Panadol / بانادول");
  });
  it("shows just the brand when no Arabic name", () => {
    expect(drugLabel({ brand_name: "Concor", brand_name_ar: null }, "x")).toBe("Concor");
  });
  it("falls back to the raw query when nothing matched", () => {
    expect(drugLabel(null, "حاجة غريبة")).toBe("حاجة غريبة");
  });
});
