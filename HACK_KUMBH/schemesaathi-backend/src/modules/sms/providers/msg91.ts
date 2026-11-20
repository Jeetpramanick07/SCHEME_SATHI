import { ISmsProvider, SmsMessage, SmsResult } from "../types.js";
import { SimulatedSmsProvider } from "./simulated.js";

export class Msg91SmsProvider implements ISmsProvider {
  readonly name = "msg91";
  private fallback = new SimulatedSmsProvider();

  async send(msg: SmsMessage): Promise<SmsResult> {
    const authKey = process.env.MSG91_AUTH_KEY;
    const senderId = process.env.MSG91_SENDER_ID || "SCHSAT";

    // Degrade cleanly to simulation if credentials are not configured
    if (!authKey) {
      console.warn("[Msg91SmsProvider] MSG91_AUTH_KEY not configured. Falling back to simulated delivery.");
      const result = await this.fallback.send(msg, "simulated_fallback");
      return {
        ...result,
        provider: "msg91 (simulated fallback)",
        status: "simulated_fallback",
      };
    }

    try {
      const response = await fetch("https://control.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authkey: authKey,
        },
        body: JSON.stringify({
          template_id: msg.template_id || process.env.MSG91_TEMPLATE_ID,
          sender: senderId,
          short_url: "0",
          mobiles: msg.to.replace(/\D/g, ""),
          var: msg.message,
        }),
      });

      if (!response.ok) {
        throw new Error(`MSG91 API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { message?: string; request_id?: string };
      return {
        success: true,
        message_id: data.request_id || `msg91_${Date.now()}`,
        provider: "msg91",
        status: "sent",
        simulated: false,
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      console.error("[Msg91SmsProvider] Send error:", err);
      // Fallback cleanly to simulated delivery
      const fallbackResult = await this.fallback.send(msg, "simulated_fallback");
      return {
        ...fallbackResult,
        provider: "msg91 (error fallback)",
        status: "simulated_fallback",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
