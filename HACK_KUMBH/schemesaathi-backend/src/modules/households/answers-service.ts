import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { detectSensitiveId, validateConsistency, ConsistencyWarning } from "../../services/consistency.js";
import { AttributeNormalizer } from "../../engine/normalizer.js";

export class AnswersService {
  /**
   * Helper to ensure no sensitive ID patterns (Aadhaar, PAN) are present in input values.
   */
  static assertNoSensitiveId(value: unknown): void {
    const check = detectSensitiveId(value);
    if (check.detected) {
      const err = new Error(
        "Government ID numbers (such as 12-digit Aadhaar or PAN) must not be entered. SchemeSaathi does not collect or store identity card numbers."
      );
      (err as unknown as { statusCode: number; code: string; message_key: string }).statusCode = 422;
      (err as unknown as { statusCode: number; code: string; message_key: string }).code = "SENSITIVE_ID_NOT_ALLOWED";
      (err as unknown as { statusCode: number; code: string; message_key: string }).message_key = "error.sensitive_id_rejected";
      throw err;
    }
  }

  /**
   * Reads all confirmed answers for a household / member.
   */
  static async getConfirmedAnswers(
    householdId: string,
    memberId?: string
  ): Promise<Record<string, unknown>> {
    const rows = await db
      .select()
      .from(schema.memberAnswers)
      .where(
        and(
          eq(schema.memberAnswers.household_id, householdId),
          eq(schema.memberAnswers.status, "confirmed")
        )
      );

    const answers: Record<string, unknown> = {};
    for (const r of rows) {
      if (!memberId || !r.member_id || r.member_id === memberId) {
        if (r.value !== null) {
          answers[r.attribute_key] = r.value;
          if (r.attribute_key === "years_in_maharashtra") {
            answers["years_in_maharashtra_gte"] = r.value;
          }
        }
      }
    }
    return answers;
  }

  /**
   * Batch upserts answers with provenance.
   */
  static async patchAnswers(
    householdId: string,
    payload: {
      answers: Record<string, unknown>;
      member_id?: string;
      source?: "self_declared" | "chatbot_confirmed" | "digilocker" | "aadhaar_qr" | "volunteer_confirmed" | "document_verified";
      updated_by_role?: string;
    },
    contextRole?: { role?: string; assistedBy?: string }
  ): Promise<{
    success: boolean;
    updated_keys: string[];
    warnings: ConsistencyWarning[];
    normalized_keys?: Array<{ original_key: string; canonical_key: string; warning: string }>;
  }> {
    // 1. Guard against sensitive IDs
    this.assertNoSensitiveId(payload.answers);

    // 2. Derive volunteer status ONLY from API key's configured role
    const isVolunteer = contextRole?.role === "volunteer";

    if (payload.source === "volunteer_confirmed" && !isVolunteer) {
      const err = new Error("Citizen API key cannot self-assert volunteer authorization or record volunteer-confirmed answers.");
      (err as unknown as { statusCode: number; code: string }).statusCode = 403;
      (err as unknown as { statusCode: number; code: string }).code = "FORBIDDEN";
      throw err;
    }

    let source = payload.source || (isVolunteer ? "volunteer_confirmed" : "self_declared");
    let updatedByRole = isVolunteer ? "volunteer" : "citizen";

    if (isVolunteer) {
      // Check that volunteer_assist consent is active (not withdrawn)
      const consents = await db
        .select()
        .from(schema.consentRecords)
        .where(
          and(
            eq(schema.consentRecords.household_id, householdId),
            eq(schema.consentRecords.purpose, "volunteer_assist")
          )
        );

      const activeConsent = consents.find((c) => c.withdrawn_at === null);
      if (!activeConsent) {
        const err = new Error("Volunteer assistance requires prior citizen consent for 'volunteer_assist'.");
        (err as unknown as { statusCode: number; code: string; message_key: string }).statusCode = 403;
        (err as unknown as { statusCode: number; code: string; message_key: string }).code = "CONSENT_REQUIRED";
        (err as unknown as { statusCode: number; code: string; message_key: string }).message_key = "consent.volunteer_assist_required";
        throw err;
      }

      source = "volunteer_confirmed";
      updatedByRole = "volunteer";
    }

    const memberId = payload.member_id || null;
    const updatedKeys: string[] = [];
    const aliasWarnings: ConsistencyWarning[] = [];
    const normalizedKeysMap: Array<{ original_key: string; canonical_key: string; warning: string }> = [];

    for (const [rawKey, val] of Object.entries(payload.answers)) {
      const norm = AttributeNormalizer.normalize(rawKey);
      const key = norm.canonicalAttribute;

      if (norm.wasBaked) {
        aliasWarnings.push({
          code: "DEPRECATED_ALIAS_NORMALIZED",
          field: rawKey,
          attribute: rawKey,
          message_key: "warning.deprecated_alias_normalized",
          message: `Key '${rawKey}' is a deprecated baked-operator alias; normalized to canonical key '${key}'.`,
          severity: "warning",
          needs_verification: false,
        });
        normalizedKeysMap.push({
          original_key: rawKey,
          canonical_key: key,
          warning: `Key '${rawKey}' is a deprecated baked-operator alias; normalized to canonical key '${key}'.`,
        });
      }

      // Upsert: check if answer already exists
      const existing = await db
        .select()
        .from(schema.memberAnswers)
        .where(
          and(
            eq(schema.memberAnswers.household_id, householdId),
            memberId
              ? eq(schema.memberAnswers.member_id, memberId)
              : sql`${schema.memberAnswers.member_id} IS NULL`,
            eq(schema.memberAnswers.attribute_key, key)
          )
        )
        .limit(1);

      if (existing[0]) {
        await db
          .update(schema.memberAnswers)
          .set({
            value: val,
            source,
            status: "confirmed",
            updated_by_role: updatedByRole,
            updated_at: new Date(),
          })
          .where(eq(schema.memberAnswers.id, existing[0].id));
      } else {
        await db.insert(schema.memberAnswers).values({
          household_id: householdId,
          member_id: memberId,
          attribute_key: key,
          value: val,
          source,
          status: "confirmed",
          updated_by_role: updatedByRole,
          updated_at: new Date(),
        });
      }
      updatedKeys.push(key);
    }

    // Run consistency checks on current state
    const allConfirmed = await this.getConfirmedAnswers(householdId, memberId || undefined);
    const warnings = validateConsistency(allConfirmed);

    return {
      success: true,
      updated_keys: updatedKeys,
      warnings: [...aliasWarnings, ...warnings],
      normalized_keys: normalizedKeysMap,
    };
  }

  /**
   * Stores proposed answers from future chatbot without affecting eligibility.
   */
  static async storeProposed(
    householdId: string,
    payload: {
      answers: Record<string, unknown>;
      member_id?: string;
      source?: "chatbot_confirmed" | "self_declared";
    }
  ): Promise<{ success: boolean; proposed_keys: string[] }> {
    this.assertNoSensitiveId(payload.answers);

    const source = payload.source || "chatbot_confirmed";
    const memberId = payload.member_id || null;
    const proposedKeys: string[] = [];

    for (const [key, val] of Object.entries(payload.answers)) {
      const existing = await db
        .select()
        .from(schema.memberAnswers)
        .where(
          and(
            eq(schema.memberAnswers.household_id, householdId),
            memberId
              ? eq(schema.memberAnswers.member_id, memberId)
              : sql`${schema.memberAnswers.member_id} IS NULL`,
            eq(schema.memberAnswers.attribute_key, key)
          )
        )
        .limit(1);

      if (existing[0]) {
        await db
          .update(schema.memberAnswers)
          .set({
            value: val,
            source,
            status: "proposed",
            updated_by_role: "chatbot",
            updated_at: new Date(),
          })
          .where(eq(schema.memberAnswers.id, existing[0].id));
      } else {
        await db.insert(schema.memberAnswers).values({
          household_id: householdId,
          member_id: memberId,
          attribute_key: key,
          value: val,
          source,
          status: "proposed",
          updated_by_role: "chatbot",
          updated_at: new Date(),
        });
      }
      proposedKeys.push(key);
    }

    return { success: true, proposed_keys: proposedKeys };
  }

  /**
   * Promotes proposed answers to confirmed with optional user edits.
   */
  static async confirmProposed(
    householdId: string,
    payload: {
      keys: string[];
      edits?: Record<string, unknown>;
      member_id?: string;
    }
  ): Promise<{
    success: boolean;
    confirmed_keys: string[];
    warnings: ConsistencyWarning[];
  }> {
    if (payload.edits) {
      this.assertNoSensitiveId(payload.edits);
    }

    const memberId = payload.member_id || null;
    const confirmedKeys: string[] = [];

    for (const key of payload.keys) {
      const editVal = payload.edits?.[key];

      const existing = await db
        .select()
        .from(schema.memberAnswers)
        .where(
          and(
            eq(schema.memberAnswers.household_id, householdId),
            memberId
              ? eq(schema.memberAnswers.member_id, memberId)
              : sql`${schema.memberAnswers.member_id} IS NULL`,
            eq(schema.memberAnswers.attribute_key, key)
          )
        )
        .limit(1);

      if (existing[0]) {
        await db
          .update(schema.memberAnswers)
          .set({
            value: editVal !== undefined ? editVal : existing[0].value,
            status: "confirmed",
            updated_by_role: "citizen",
            updated_at: new Date(),
          })
          .where(eq(schema.memberAnswers.id, existing[0].id));
        confirmedKeys.push(key);
      }
    }

    const allConfirmed = await this.getConfirmedAnswers(householdId, memberId || undefined);
    const warnings = validateConsistency(allConfirmed);

    return {
      success: true,
      confirmed_keys: confirmedKeys,
      warnings,
    };
  }
}
