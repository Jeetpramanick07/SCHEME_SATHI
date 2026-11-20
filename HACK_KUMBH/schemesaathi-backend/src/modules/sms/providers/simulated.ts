import { ISmsProvider, SmsMessage, SmsResult } from "../types.js";
import { db } from "../../../db/index.js";
import * as schema from "../../../db/schema.js";

export class SimulatedSmsProvider implements ISmsProvider {
  readonly name = "simulated";

  async send(msg: SmsMessage, statusOverride?: "simulated_delivered" | "simulated_fallback"): Promise<SmsResult> {
    const status = statusOverride || "simulated_delivered";
    const messageId = `sms_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    try {
      await db.insert(schema.simulatedSmsMessages).values({
        id: messageId,
        household_id: msg.household_id || null,
        phone: msg.to,
        message: msg.message,
        status,
        provider: "simulated",
        created_at: new Date(),
      });
    } catch (err) {
      console.warn("[SimulatedSmsProvider] Failed to persist message to database, keeping in-memory log:", err);
    }

    return {
      success: true,
      message_id: messageId,
      provider: "simulated",
      status,
      simulated: true,
      timestamp,
    };
  }
}
