import { describe, it, expect } from "vitest";
import { AttributeNormalizer } from "../src/engine/normalizer.js";

describe("Attribute Normalizer", () => {
  it("normalizes baked operator and value with _lte_<number>", () => {
    const res = AttributeNormalizer.normalize("annual_family_income_lte_800000");
    expect(res.canonicalAttribute).toBe("annual_family_income");
    expect(res.inferredOperator).toBe("LESS_THAN_OR_EQUAL");
    expect(res.inferredValue).toBe(800000);
    expect(res.wasBaked).toBe(true);
  });

  it("normalizes baked operator and value with monthly_income_lte_15000", () => {
    const res = AttributeNormalizer.normalize("monthly_income_lte_15000");
    expect(res.canonicalAttribute).toBe("monthly_income");
    expect(res.inferredOperator).toBe("LESS_THAN_OR_EQUAL");
    expect(res.inferredValue).toBe(15000);
    expect(res.wasBaked).toBe(true);
  });

  it("normalizes baked operator suffix _gte", () => {
    const res = AttributeNormalizer.normalize("years_in_maharashtra_gte");
    expect(res.canonicalAttribute).toBe("years_in_maharashtra");
    expect(res.inferredOperator).toBe("GREATER_THAN_OR_EQUAL");
    expect(res.wasBaked).toBe(true);
  });

  it("normalizes baked operator suffix _in", () => {
    const res1 = AttributeNormalizer.normalize("taluka_in");
    expect(res1.canonicalAttribute).toBe("taluka");
    expect(res1.inferredOperator).toBe("IN");
    expect(res1.wasBaked).toBe(true);

    const res2 = AttributeNormalizer.normalize("marital_status_in");
    expect(res2.canonicalAttribute).toBe("marital_status");
    expect(res2.inferredOperator).toBe("IN");
    expect(res2.wasBaked).toBe(true);
  });

  it("preserves standard canonical attribute names unchanged", () => {
    const res = AttributeNormalizer.normalize("age");
    expect(res.canonicalAttribute).toBe("age");
    expect(res.wasBaked).toBe(false);
  });

  it("infers appropriate attribute scopes", () => {
    expect(AttributeNormalizer.inferScope("age")).toBe("member");
    expect(AttributeNormalizer.inferScope("gender")).toBe("member");
    expect(AttributeNormalizer.inferScope("family_member_income_tax_payer")).toBe("household");
    expect(AttributeNormalizer.inferScope("annual_family_income")).toBe("household");
  });
});
