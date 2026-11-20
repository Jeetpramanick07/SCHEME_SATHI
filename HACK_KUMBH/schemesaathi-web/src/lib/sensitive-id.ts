/**
 * Sensitive ID Guard
 * Scans user string inputs to prevent accidental submission of Aadhaar, PAN,
 * or Bank Account numbers.
 */

const AADHAAR_REGEX = /\b[2-9]{1}[0-9]{3}[ -]?[0-9]{4}[ -]?[0-9]{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/i;
const BANK_ACCOUNT_REGEX = /\b[0-9]{11,18}\b/;

export interface SensitiveIdCheckResult {
  detected: boolean;
  type?: "AADHAAR" | "PAN" | "BANK_ACCOUNT";
  message?: string;
}

export function detectSensitiveId(value: unknown): SensitiveIdCheckResult {
  if (typeof value !== "string" || !value.trim()) {
    return { detected: false };
  }

  const str = value.trim();

  if (AADHAAR_REGEX.test(str)) {
    return {
      detected: true,
      type: "AADHAAR",
      message: "Detected potential 12-digit Aadhaar number. For your safety, do not enter your real government ID numbers.",
    };
  }

  if (PAN_REGEX.test(str)) {
    return {
      detected: true,
      type: "PAN",
      message: "Detected potential PAN number format. Do not submit tax ID numbers.",
    };
  }

  if (BANK_ACCOUNT_REGEX.test(str)) {
    return {
      detected: true,
      type: "BANK_ACCOUNT",
      message: "Detected potential bank account number. Do not enter financial account details here.",
    };
  }

  return { detected: false };
}
