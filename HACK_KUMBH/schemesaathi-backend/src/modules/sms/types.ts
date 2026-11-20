export interface SmsMessage {
  to: string;
  message: string;
  template_id?: string;
  household_id?: string;
  metadata?: Record<string, unknown>;
}

export interface SmsResult {
  success: boolean;
  message_id: string;
  provider: "simulated" | "msg91" | "twilio" | string;
  status: "simulated_delivered" | "simulated_fallback" | "sent" | "failed";
  simulated: boolean;
  error?: string;
  timestamp: string;
}

export interface ISmsProvider {
  readonly name: string;
  send(msg: SmsMessage): Promise<SmsResult>;
}
