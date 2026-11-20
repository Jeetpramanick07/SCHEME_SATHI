import { ISmsProvider, SmsMessage, SmsResult } from "../types.js";
import { SimulatedSmsProvider } from "./simulated.js";

export class TwilioSmsProvider implements ISmsProvider {
  readonly name = "twilio";
  private fallback = new SimulatedSmsProvider();

  async send(msg: SmsMessage): Promise<SmsResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    // Degrade cleanly to simulation if credentials are not configured
    if (!accountSid || !authToken || !fromNumber) {
      console.warn("[TwilioSmsProvider] Twilio credentials not configured. Falling back to simulated delivery.");
      const result = await this.fallback.send(msg, "simulated_fallback");
      return {
        ...result,
        provider: "twilio (simulated fallback)",
        status: "simulated_fallback",
      };
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const formattedTo = msg.to.startsWith("+") ? msg.to : `+91${msg.to.replace(/\D/g, "")}`;

      const params = new URLSearchParams();
      params.append("To", formattedTo);
      params.append("From", fromNumber);
      params.append("Body", msg.message);

      const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`Twilio API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { sid?: string; status?: string };
      return {
        success: true,
        message_id: data.sid || `twilio_${Date.now()}`,
        provider: "twilio",
        status: "sent",
        simulated: false,
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      console.error("[TwilioSmsProvider] Send error:", err);
      const fallbackResult = await this.fallback.send(msg, "simulated_fallback");
      return {
        ...fallbackResult,
        provider: "twilio (error fallback)",
        status: "simulated_fallback",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
