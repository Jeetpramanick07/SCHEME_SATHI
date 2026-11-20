export interface ReminderItem {
  id: string;
  household_id: string;
  member_id?: string;
  type: "DOCUMENT_EXPIRING" | "MISSING_DOCUMENT" | "APPLICATION_DEADLINE" | "PENDING_STEP";
  priority: "HIGH" | "MEDIUM" | "LOW";
  channel: "in_app" | "sms" | "whatsapp";
  title: string;
  message: string;
  due_date?: string;
  action_url?: string;
}
