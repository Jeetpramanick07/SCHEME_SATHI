import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";

export class ApplicationService {
  static async createApplication(data: {
    household_id: string;
    member_id: string;
    scheme_id: string;
    reference_no?: string;
  }) {
    const sch = await db
      .select()
      .from(schema.schemes)
      .where(eq(schema.schemes.scheme_id, data.scheme_id))
      .limit(1);

    if (!sch[0]) {
      throw new Error(`Scheme '${data.scheme_id}' not found`);
    }

    const raw = sch[0].raw as Record<string, unknown>;
    const applicationData = (raw.application as Record<string, unknown>) || {};
    const trackingData = (raw.tracking as Record<string, unknown>) || {};
    const rawSteps = (applicationData.steps as Array<Record<string, unknown>>) || [];

    const appId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const trackingUrl = trackingData.tracking_url ? String(trackingData.tracking_url) : null;

    // 1. Insert application
    await db.insert(schema.applications).values({
      application_id: appId,
      household_id: data.household_id,
      member_id: data.member_id,
      scheme_id: data.scheme_id,
      status: "DRAFT",
      reference_no: data.reference_no || null,
      tracking_url: trackingUrl,
      current_step_number: 1,
    });

    // 2. Insert steps from scheme definition
    if (rawSteps.length > 0) {
      for (const step of rawSteps) {
        const stepId = `${appId}_step_${step.step_number}`;
        await db.insert(schema.applicationSteps).values({
          id: stepId,
          application_id: appId,
          step_number: Number(step.step_number),
          title: String(step.title),
          description: step.description ? String(step.description) : null,
          status: Number(step.step_number) === 1 ? "IN_PROGRESS" : "PENDING",
        });
      }
    } else {
      // Create a default submission step if none provided
      await db.insert(schema.applicationSteps).values({
        id: `${appId}_step_1`,
        application_id: appId,
        step_number: 1,
        title: "Submit Application Online / CSC Center",
        description: "Submit documents and verify biometric details",
        status: "IN_PROGRESS",
      });
    }

    // 3. Insert audit event
    await db.insert(schema.applicationAuditEvents).values({
      application_id: appId,
      previous_status: null,
      new_status: "DRAFT",
      note: "Application initialized from scheme definition",
    });

    return await this.getApplication(appId);
  }

  static async getApplication(applicationId: string) {
    const app = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.application_id, applicationId))
      .limit(1);

    if (!app[0]) return null;

    const steps = await db
      .select()
      .from(schema.applicationSteps)
      .where(eq(schema.applicationSteps.application_id, applicationId));

    const auditEvents = await db
      .select()
      .from(schema.applicationAuditEvents)
      .where(eq(schema.applicationAuditEvents.application_id, applicationId));

    // Scheme tracking rules
    const sch = await db
      .select()
      .from(schema.schemes)
      .where(eq(schema.schemes.scheme_id, app[0].scheme_id))
      .limit(1);

    const raw = sch[0]?.raw as Record<string, unknown> | undefined;
    const tracking = (raw?.tracking as Record<string, unknown>) || {};

    const trackingInstructions = {
      tracking_available: Boolean(tracking.tracking_available),
      tracking_type: tracking.tracking_type || "PORTAL",
      tracking_url: tracking.tracking_url || null,
      reference_number_required: Boolean(tracking.reference_number_required),
      api_available: Boolean(tracking.api_available),
      instructions: tracking.api_available
        ? "Status can be checked automatically via integrated state API"
        : "Automated status API is not available for this scheme. Updates must be verified manually on the portal using your registration reference number.",
    };

    return {
      ...app[0],
      steps: steps.sort((a, b) => a.step_number - b.step_number),
      audit_events: auditEvents.sort((a, b) => (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0)),
      tracking_instructions: trackingInstructions,
    };
  }

  static async updateStatus(
    applicationId: string,
    newStatus: "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED",
    note?: string,
    currentStepNumber?: number
  ) {
    const app = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.application_id, applicationId))
      .limit(1);

    if (!app[0]) return null;
    const previousStatus = app[0].status;

    await db
      .update(schema.applications)
      .set({
        status: newStatus,
        current_step_number: currentStepNumber ?? app[0].current_step_number,
        updated_at: new Date(),
      })
      .where(eq(schema.applications.application_id, applicationId));

    // Audit event
    await db.insert(schema.applicationAuditEvents).values({
      application_id: applicationId,
      previous_status: previousStatus,
      new_status: newStatus,
      note: note || `Status transitioned to ${newStatus}`,
    });

    return await this.getApplication(applicationId);
  }

  static async updateStepStatus(
    stepId: string,
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED"
  ) {
    await db
      .update(schema.applicationSteps)
      .set({
        status,
        completed_at: status === "COMPLETED" ? new Date() : null,
      })
      .where(eq(schema.applicationSteps.id, stepId));

    const step = await db
      .select()
      .from(schema.applicationSteps)
      .where(eq(schema.applicationSteps.id, stepId))
      .limit(1);

    return step[0];
  }

  static async recordOutcome(
    applicationId: string,
    data: {
      outcome: "approved" | "rejected" | "pending" | "withdrawn";
      rejection_reason_code?: string;
      rejection_note?: string;
      outcome_recorded_by_role?: string;
    }
  ) {
    const app = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.application_id, applicationId))
      .limit(1);

    if (!app[0]) return null;

    const newStatus =
      data.outcome === "approved"
        ? "APPROVED"
        : data.outcome === "rejected"
          ? "REJECTED"
          : app[0].status;

    await db
      .update(schema.applications)
      .set({
        outcome: data.outcome,
        status: newStatus,
        rejection_reason_code: data.rejection_reason_code || null,
        rejection_note: data.rejection_note || null,
        outcome_recorded_by_role: data.outcome_recorded_by_role || "citizen",
        outcome_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(schema.applications.application_id, applicationId));

    await db.insert(schema.applicationAuditEvents).values({
      application_id: applicationId,
      previous_status: app[0].status,
      new_status: newStatus,
      note: data.rejection_note || `Outcome recorded: ${data.outcome} (${data.rejection_reason_code || "no code"})`,
    });

    return await this.getApplication(applicationId);
  }
}
