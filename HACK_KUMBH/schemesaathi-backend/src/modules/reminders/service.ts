import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { ReminderItem } from "./schema.js";

export class ReminderService {
  /**
   * Generates actionable reminders for a household (missing/expiring documents, deadlines, pending steps).
   * Note: Channel field only; no external SMS/WhatsApp sending is triggered.
   */
  static async getRemindersForHousehold(
    householdId: string,
    lang: "en" | "hi" | "mr" = "en"
  ): Promise<ReminderItem[]> {
    const reminders: ReminderItem[] = [];

    // 1. Check household documents (expiring or expired)
    const docs = await db
      .select()
      .from(schema.householdDocuments)
      .where(eq(schema.householdDocuments.household_id, householdId));

    const now = Date.now();
    for (const d of docs) {
      if (d.status === "expired") {
        reminders.push({
          id: `rem_doc_exp_${d.id}`,
          household_id: householdId,
          member_id: d.member_id || undefined,
          type: "DOCUMENT_EXPIRING",
          priority: "HIGH",
          channel: "in_app",
          title: lang === "mr" ? "कालबाह्य दस्तऐवज" : lang === "hi" ? "समाप्त दस्तावेज" : "Expired Document",
          message:
            lang === "mr"
              ? `दस्तऐवज '${d.document_id}' कालबाह्य झाले आहे. कृपया त्वरित नूतनीकरण करा.`
              : lang === "hi"
                ? `दस्तावेज '${d.document_id}' की वैधता समाप्त हो चुकी है। कृपया नवीनीकरण करें।`
                : `Document '${d.document_id}' has expired. Please renew it to prevent application rejection.`,
        });
      } else if (d.expires_on) {
        const expDate = new Date(d.expires_on).getTime();
        const daysLeft = Math.ceil((expDate - now) / (1000 * 3600 * 24));
        if (daysLeft >= 0 && daysLeft <= 30) {
          reminders.push({
            id: `rem_doc_soon_${d.id}`,
            household_id: householdId,
            member_id: d.member_id || undefined,
            type: "DOCUMENT_EXPIRING",
            priority: daysLeft <= 7 ? "HIGH" : "MEDIUM",
            channel: "in_app",
            title: lang === "mr" ? "दस्तऐवज लवकरच संपत आहे" : lang === "hi" ? "दस्तावेज जल्द समाप्त हो रहा है" : "Document Expiring Soon",
            message:
              lang === "mr"
                ? `दस्तऐवज '${d.document_id}' ${daysLeft} दिवसांत कालबाह्य होत आहे.`
                : lang === "hi"
                  ? `दस्तावेज '${d.document_id}' ${daysLeft} दिनों में समाप्त हो रहा है।`
                  : `Document '${d.document_id}' expires in ${daysLeft} days. Renewal recommended.`,
            due_date: d.expires_on,
          });
        }
      }
    }

    // 2. Check active applications & pending steps
    const apps = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.household_id, householdId));

    for (const app of apps) {
      if (app.status === "DRAFT" || app.status === "IN_REVIEW") {
        const steps = await db
          .select()
          .from(schema.applicationSteps)
          .where(eq(schema.applicationSteps.application_id, app.application_id));

        const pending = steps.find((s) => s.status === "IN_PROGRESS" || s.status === "PENDING");
        if (pending) {
          reminders.push({
            id: `rem_step_${pending.id}`,
            household_id: householdId,
            member_id: app.member_id,
            type: "PENDING_STEP",
            priority: "MEDIUM",
            channel: "in_app",
            title:
              lang === "mr"
                ? `प्रलंबित पायरी: ${pending.title}`
                : lang === "hi"
                  ? `लंबित चरण: ${pending.title}`
                  : `Pending Action: ${pending.title}`,
            message:
              lang === "mr"
                ? `योजना अर्ज '${app.scheme_id}' मधील पायरी ${pending.step_number} पूर्ण करणे आवश्यक आहे.`
                : lang === "hi"
                  ? `योजना आवेदन '${app.scheme_id}' का चरण ${pending.step_number} पूरा करें।`
                  : `Step ${pending.step_number} for scheme '${app.scheme_id}' is pending: ${pending.description || pending.title}`,
          });
        }
      }
    }

    return reminders;
  }
}
