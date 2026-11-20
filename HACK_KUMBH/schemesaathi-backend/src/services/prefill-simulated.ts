import { config } from "../config.js";
import { IdentityPrefill, PrefillResult } from "./ports.js";

/**
 * Normalizes gender value to standard enum MALE | FEMALE | TRANSGENDER
 */
function normalizeGender(val: unknown): "MALE" | "FEMALE" | "TRANSGENDER" | undefined {
  if (typeof val !== "string") return undefined;
  const upper = val.toUpperCase().trim();
  if (upper === "M" || upper === "MALE") return "MALE";
  if (upper === "F" || upper === "FEMALE") return "FEMALE";
  if (upper === "T" || upper === "TRANS" || upper === "TRANSGENDER") return "TRANSGENDER";
  return undefined;
}

/**
 * Strict whitelist filter: ONLY extracts age, gender, district.
 * Explicitly blocks name, aadhaar number, photo, address, etc.
 */
function extractWhitelistedAttributes(input: Record<string, unknown>): {
  age?: number;
  gender?: "MALE" | "FEMALE" | "TRANSGENDER";
  district?: string;
} {
  const result: {
    age?: number;
    gender?: "MALE" | "FEMALE" | "TRANSGENDER";
    district?: string;
  } = {};

  if (typeof input.age === "number" && input.age > 0 && input.age < 130) {
    result.age = input.age;
  } else if (typeof input.dob === "string" || typeof input.date_of_birth === "string") {
    const dobStr = String(input.dob || input.date_of_birth);
    const birthYear = parseInt(dobStr.substring(0, 4), 10);
    if (!isNaN(birthYear) && birthYear > 1900) {
      result.age = new Date().getFullYear() - birthYear;
    }
  }

  const gender = normalizeGender(input.gender || input.sex);
  if (gender) {
    result.gender = gender;
  }

  if (typeof input.district === "string" && input.district.trim().length > 0) {
    result.district = input.district.trim();
  }

  return result;
}

export class SimulatedDigiLocker implements IdentityPrefill {
  async prefill(input: Record<string, unknown>): Promise<PrefillResult> {
    if (!config.enableSimulatedPrefill) {
      throw new Error("Simulated prefill is disabled by configuration");
    }

    // Default simulation data if empty input provided
    const sourceData = Object.keys(input).length > 0
      ? input
      : { age: 62, gender: "FEMALE", district: "Nagpur" };

    const attributes = extractWhitelistedAttributes(sourceData);

    return {
      attributes,
      source: "digilocker",
      simulated: true,
    };
  }
}

export class SimulatedAadhaarQr implements IdentityPrefill {
  async prefill(input: Record<string, unknown>): Promise<PrefillResult> {
    if (!config.enableSimulatedPrefill) {
      throw new Error("Simulated prefill is disabled by configuration");
    }

    // Default simulation data if empty input provided
    const sourceData = Object.keys(input).length > 0
      ? input
      : { age: 62, gender: "FEMALE", district: "Nagpur" };

    const attributes = extractWhitelistedAttributes(sourceData);

    return {
      attributes,
      source: "aadhaar_qr",
      simulated: true,
    };
  }
}
