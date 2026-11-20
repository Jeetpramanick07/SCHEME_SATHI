import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";

export class ConsentService {
  /**
   * Records a consent decision.
   */
  static async recordConsent(data: {
    household_id: string;
    purpose: "data_processing" | "sms_reminders" | "volunteer_assist";
    text_version?: string;
    lang?: string;
  }) {
    const inserted = await db
      .insert(schema.consentRecords)
      .values({
        household_id: data.household_id,
        purpose: data.purpose,
        text_version: data.text_version || "v1.0",
        lang: data.lang || "en",
      })
      .returning();

    return inserted[0];
  }

  /**
   * Withdraws a previously granted consent.
   */
  static async withdrawConsent(consentId: number) {
    const existing = await db
      .select()
      .from(schema.consentRecords)
      .where(eq(schema.consentRecords.id, consentId))
      .limit(1);

    if (!existing[0]) return null;

    const withdrawnAt = new Date();
    await db
      .update(schema.consentRecords)
      .set({ withdrawn_at: withdrawnAt })
      .where(eq(schema.consentRecords.id, consentId));

    return {
      id: consentId,
      household_id: existing[0].household_id,
      purpose: existing[0].purpose,
      withdrawn_at: withdrawnAt.toISOString(),
    };
  }

  /**
   * Records applicant declaration.
   */
  static async recordDeclaration(data: {
    household_id: string;
    text_version?: string;
    lang?: string;
  }) {
    const inserted = await db
      .insert(schema.declarations)
      .values({
        household_id: data.household_id,
        text_version: data.text_version || "v1.0",
        lang: data.lang || "en",
      })
      .returning();

    return inserted[0];
  }

  /**
   * Right to be forgotten (cascade hard delete of household and all associated personal data).
   * Leaves only an anonymized audit row with zero PII.
   */
  static async rightToBeForgotten(householdId: string): Promise<{ success: boolean; erased_household_id: string }> {
    const hh = await db
      .select()
      .from(schema.households)
      .where(eq(schema.households.household_id, householdId))
      .limit(1);

    if (!hh[0]) {
      throw new Error(`Household '${householdId}' not found`);
    }

    const members = await db
      .select({ id: schema.householdMembers.member_id })
      .from(schema.householdMembers)
      .where(eq(schema.householdMembers.household_id, householdId));

    const apps = await db
      .select({ id: schema.applications.application_id })
      .from(schema.applications)
      .where(eq(schema.applications.household_id, householdId));

    const appIds = apps.map((a) => a.id);

    // 1. Delete application audit events and steps
    if (appIds.length > 0) {
      await db.delete(schema.applicationAuditEvents).where(inArray(schema.applicationAuditEvents.application_id, appIds));
      await db.delete(schema.applicationSteps).where(inArray(schema.applicationSteps.application_id, appIds));
      await db.delete(schema.applications).where(inArray(schema.applications.application_id, appIds));
    }

    // 2. Delete answers, consents, declarations, documents, members, reminders, simulated_sms_messages
    await db.delete(schema.reminders).where(eq(schema.reminders.household_id, householdId));
    await db.delete(schema.simulatedSmsMessages).where(eq(schema.simulatedSmsMessages.household_id, householdId));
    await db.delete(schema.memberAnswers).where(eq(schema.memberAnswers.household_id, householdId));
    await db.delete(schema.consentRecords).where(eq(schema.consentRecords.household_id, householdId));
    await db.delete(schema.declarations).where(eq(schema.declarations.household_id, householdId));
    await db.delete(schema.householdDocuments).where(eq(schema.householdDocuments.household_id, householdId));
    await db.delete(schema.householdMembers).where(eq(schema.householdMembers.household_id, householdId));

    // 3. Delete household
    await db.delete(schema.households).where(eq(schema.households.household_id, householdId));

    // 4. Log purely anonymized audit record (NO PII)
    await db.insert(schema.anonymizedDeletionLogs).values({
      household_deleted_at: new Date(),
      district_id: hh[0].district_id || null,
      member_count: members.length,
    });

    return {
      success: true,
      erased_household_id: householdId,
    };
  }
}
