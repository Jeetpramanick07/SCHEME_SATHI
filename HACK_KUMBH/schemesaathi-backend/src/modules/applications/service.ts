import fs from "node:fs";
import path from "node:path";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";

export interface StepTranslationItem {
  title?: { en?: string; hi?: string; mr?: string; [k: string]: string | undefined };
  description?: { en?: string; hi?: string; mr?: string; [k: string]: string | undefined };
}

export class ApplicationService {
  private static stepTranslationsCache: Record<string, Record<string, StepTranslationItem>> | null = null;

  static getStepTranslations(): Record<string, Record<string, StepTranslationItem>> {
    if (this.stepTranslationsCache) return this.stepTranslationsCache;
    const candidates = [
      path.resolve(process.cwd(), "data/step_translations.json"),
      path.resolve(process.cwd(), "../data/step_translations.json"),
      path.resolve(process.cwd(), "schemesaathi-backend/data/step_translations.json"),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        try {
          this.stepTranslationsCache = JSON.parse(fs.readFileSync(c, "utf-8"));
          return this.stepTranslationsCache || {};
        } catch {
          // ignore
        }
      }
    }
    return {};
  }

  static async createApplication(data: {
    household_id: string;
    member_id: string;
    scheme_id: string;
    reference_no?: string;
  }) {
    const hh = await db
      .select({ id: schema.households.household_id })
      .from(schema.households)
      .where(eq(schema.households.household_id, data.household_id))
      .limit(1);

    if (!hh[0]) {
      throw new Error(`Household '${data.household_id}' not found`);
    }

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

  static async getApplication(applicationId: string, lang: "en" | "hi" | "mr" = "en", householdId?: string) {
    const conditions = [eq(schema.applications.application_id, applicationId)];
    if (householdId) {
      conditions.push(eq(schema.applications.household_id, householdId));
    }

    const app = await db
      .select()
      .from(schema.applications)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]!)
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

    const statusLabels: Record<string, { en: string; hi: string; mr: string }> = {
      DRAFT: { en: "Draft", mr: "मसुदा (अपूर्ण)", hi: "प्रारूप (अधूरा)" },
      SUBMITTED: { en: "Submitted", mr: "अर्ज सादर केला", hi: "आवेदन जमा किया" },
      IN_REVIEW: { en: "In Review", mr: "तपासणी सुरू", hi: "समीक्षा जारी" },
      APPROVED: { en: "Approved", mr: "मंजूर झाला", hi: "स्वीकृत" },
      REJECTED: { en: "Rejected", mr: "नाकारला गेला", hi: "अस्वीकृत" },
    };

    const statusObj = statusLabels[app[0].status] || { en: app[0].status, mr: app[0].status, hi: app[0].status };
    const statusLabel = statusObj[lang] || statusObj.en;

    let hasLangFallback = false;
    const stepDict = this.getStepTranslations();
    const localizedSteps = steps
      .sort((a, b) => a.step_number - b.step_number)
      .map((step) => {
        const byScheme = stepDict[app[0]!.scheme_id] as Record<string, StepTranslationItem> | undefined;
        const stepTrans: StepTranslationItem | undefined =
          byScheme?.[String(step.step_number)] ||
          (stepDict[`${app[0]!.scheme_id}_${step.step_number}`] as StepTranslationItem | undefined);
        let stepTitle = step.title;
        let stepDesc = step.description;

        if (lang === "mr" || lang === "hi") {
          const transTitle = stepTrans?.title?.[lang];
          const transDesc = stepTrans?.description?.[lang];
          if (transTitle && transDesc) {
            stepTitle = transTitle;
            stepDesc = transDesc;
          } else {
            hasLangFallback = true;
          }
        }

        return {
          ...step,
          title: stepTitle,
          description: stepDesc,
        };
      });

    let trackingMsg = tracking.api_available
      ? "Status can be checked automatically via integrated state API"
      : "Automated status API is not available for this scheme. Updates must be verified manually on the portal using your registration reference number.";

    if (lang === "mr") {
      trackingMsg = tracking.api_available
        ? "नोंदणी अर्जाची सद्यस्थिती राज्य सरकारच्या संगणकीय प्रणालीद्वारे आपोआप तपासली जाते."
        : "या योजनेसाठी अर्जाची तपासणी करण्यासाठी आपल्या अर्ज नोंदणी क्रमांकाचा वापर करून अधिकृत पोर्टलवर खात्री करावी लागते.";
    } else if (lang === "hi") {
      trackingMsg = tracking.api_available
        ? "आवेदन की वर्तमान स्थिति एकीकृत राज्य सरकारी पोर्टल द्वारा स्वतः जांची जाती है।"
        : "इस योजना की स्थिति जांचने के लिए अपने पंजीकरण संदर्भ नंबर से आधिकारिक पोर्टल पर जांच करनी होगी।";
    }

    const trackingInstructions = {
      tracking_available: Boolean(tracking.tracking_available),
      tracking_type: tracking.tracking_type || "PORTAL",
      tracking_url: tracking.tracking_url || null,
      reference_number_required: Boolean(tracking.reference_number_required),
      api_available: Boolean(tracking.api_available),
      instructions: trackingMsg,
      tracking_message: trackingMsg,
    };

    return {
      ...app[0],
      status_label: statusLabel,
      steps: localizedSteps,
      audit_events: auditEvents.sort((a, b) => (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0)),
      tracking_instructions: trackingInstructions,
      lang_served: hasLangFallback ? "en" : lang,
      lang_fallback: hasLangFallback,
    };
  }

  static async updateStatus(
    applicationId: string,
    newStatus: "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED",
    note?: string,
    currentStepNumber?: number,
    householdId?: string
  ) {
    const conditions = [eq(schema.applications.application_id, applicationId)];
    if (householdId) {
      conditions.push(eq(schema.applications.household_id, householdId));
    }

    const app = await db
      .select()
      .from(schema.applications)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]!)
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
}
