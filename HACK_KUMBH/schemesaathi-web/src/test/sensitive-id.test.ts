import { describe, it, expect } from "vitest";
import { detectSensitiveId } from "../lib/sensitive-id";

describe("Sensitive ID Guard", () => {
  it("detects 12-digit Aadhaar numbers with and without spaces", () => {
    expect(detectSensitiveId("3675 9834 1234").detected).toBe(true);
    expect(detectSensitiveId("367598341234").detected).toBe(true);
    expect(detectSensitiveId("My Aadhaar is 5432-1234-5678").detected).toBe(true);
  });

  it("detects 10-character PAN card format", () => {
    expect(detectSensitiveId("ABCDE1234F").detected).toBe(true);
    expect(detectSensitiveId("pan: ABCDE1234F").detected).toBe(true);
  });

  it("detects 11-18 digit bank account numbers", () => {
    expect(detectSensitiveId("123456789012").detected).toBe(true);
    expect(detectSensitiveId("987654321098765").detected).toBe(true);
  });

  it("does not flag non-string values or safe inputs", () => {
    expect(detectSensitiveId(20000).detected).toBe(false);
    expect(detectSensitiveId(true).detected).toBe(false);
    expect(detectSensitiveId("Nagpur Urban").detected).toBe(false);
    expect(detectSensitiveId("Widow with 2 children").detected).toBe(false);
    expect(detectSensitiveId("9876543210").detected).toBe(false); // 10 digit phone is safe
  });
});
