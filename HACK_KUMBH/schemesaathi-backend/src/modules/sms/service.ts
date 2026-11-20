import { ISmsProvider, SmsMessage, SmsResult } from "./types.js";
import { SimulatedSmsProvider } from "./providers/simulated.js";
import { Msg91SmsProvider } from "./providers/msg91.js";
import { TwilioSmsProvider } from "./providers/twilio.js";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { eq, and, isNull, desc } from "drizzle-orm";

export class SmsServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message);
    this.name = "SmsServiceError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class SmsService {
  private static providerInstance: ISmsProvider | null = null;

  static getProvider(): ISmsProvider {
    if (!this.providerInstance) {
      const providerName = (process.env.SMS_PROVIDER || "simulated").toLowerCase().trim();
      switch (providerName) {
        case "msg91":
          this.providerInstance = new Msg91SmsProvider();
          break;
        case "twilio":
          this.providerInstance = new TwilioSmsProvider();
          break;
        case "simulated":
        default:
          this.providerInstance = new SimulatedSmsProvider();
          break;
      }
    }
    return this.providerInstance;
  }

  // Force provider switch (useful for tests)
  static setProvider(provider: ISmsProvider | null) {
    this.providerInstance = provider;
  }

  /**
   * Asserts that no message contains forbidden wording guaranteeing benefits or "you will receive".
   */
  static assertNoForbiddenWording(message: string): void {
    const forbidden = [
      /you\s+will\s+receive/i,
      /you\s+will\s+get/i,
      /तुम्हाला.*मिळेल/i,
      /तुम्हाला.*मिळते/i,
      /आपको.*मिलेगा/i,
      /आपको.*मिलता\s+है/i,
      /guaranteed\s+benefit/i,
    ];

    for (const pattern of forbidden) {
      if (pattern.test(message)) {
        throw new SmsServiceError(
          "Forbidden wording detected in SMS message: SchemeSaathi cannot promise 'you will receive' or guarantee benefits. Use truthful, neutral phrasing.",
          "FORBIDDEN_WORDING",
          422
        );
      }
    }
  }

  /**
   * Validates phone number format (10-digit Indian mobile number).
   */
  static validatePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, "");
    // Extract last 10 digits if country code is included (e.g., 919876543210 -> 9876543210)
    const tenDigits = cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
    if (tenDigits.length !== 10 || !/^[6-9]\d{9}$/.test(tenDigits)) {
      throw new SmsServiceError(
        `Invalid phone number '${phone}'. A valid 10-digit Indian mobile number starting with 6-9 is required.`,
        "PHONE_REQUIRED",
        400
      );
    }
    return tenDigits;
  }

  /**
   * Resolves recipient phone and verifies active SMS reminder consent.
   */
  static async resolveRecipientAndConsent(params: {
    household_id?: string;
    to?: string;
  }): Promise<{ phone: string; household_id?: string; is_synthetic: boolean }> {
    let resolvedPhone: string | null = null;
    let isSynthetic = false;

    if (params.household_id) {
      // 1. Fetch household
      const [hh] = await db
        .select()
        .from(schema.households)
        .where(eq(schema.households.household_id, params.household_id))
        .limit(1);

      if (!hh) {
        throw new SmsServiceError(
          `Household '${params.household_id}' not found.`,
          "HOUSEHOLD_NOT_FOUND",
          404
        );
      }

      isSynthetic = Boolean(hh.is_synthetic) || params.household_id.startsWith("hh_synth_");

      // Check phone on household or member answers
      if (params.to) {
        resolvedPhone = params.to;
      } else if (hh.contact_phone) {
        resolvedPhone = hh.contact_phone;
      } else {
        // Look up member answers
        const answers = await db
          .select()
          .from(schema.memberAnswers)
          .where(
            and(
              eq(schema.memberAnswers.household_id, params.household_id),
              eq(schema.memberAnswers.attribute_key, "phone_number")
            )
          )
          .limit(1);

        const firstAns = answers[0];
        if (firstAns && typeof firstAns.value === "string") {
          resolvedPhone = firstAns.value;
        }
      }

      if (!resolvedPhone) {
        throw new SmsServiceError(
          "No phone number registered for this household. Please provide a valid phone number.",
          "PHONE_REQUIRED",
          400
        );
      }

      // 2. Check active SMS consent in consent_records
      const activeConsent = await db
        .select()
        .from(schema.consentRecords)
        .where(
          and(
            eq(schema.consentRecords.household_id, params.household_id),
            eq(schema.consentRecords.purpose, "sms_reminders"),
            isNull(schema.consentRecords.withdrawn_at)
          )
        )
        .limit(1);

      if (activeConsent.length === 0) {
        throw new SmsServiceError(
          "Active consent for 'sms_reminders' is required before sending SMS. Consent is missing or was withdrawn.",
          "CONSENT_REQUIRED",
          403
        );
      }
    } else {
      // Ad-hoc recipient without household ID: phone is strictly required
      if (!params.to) {
        throw new SmsServiceError(
          "Recipient phone number is required.",
          "PHONE_REQUIRED",
          400
        );
      }
      resolvedPhone = params.to;
    }

    const validatedPhone = this.validatePhoneNumber(resolvedPhone);
    return { phone: validatedPhone, household_id: params.household_id, is_synthetic: isSynthetic };
  }

  /**
   * Sends an SMS message through the configured provider, enforcing consent, phone format, and wording guards.
   */
  static async sendSms(msg: SmsMessage): Promise<SmsResult> {
    // 1. Guard against dishonest or promissory wording
    this.assertNoForbiddenWording(msg.message);

    // 2. Resolve recipient & verify consent
    const { phone, is_synthetic } = await this.resolveRecipientAndConsent({
      household_id: msg.household_id,
      to: msg.to,
    });

    // 3. Delegate to provider with synthetic safety enforcement:
    // Synthetic households (is_synthetic=true) must NEVER be sent through external gateways (msg91/twilio).
    let provider = this.getProvider();
    if (is_synthetic || msg.household_id?.startsWith("hh_synth_")) {
      if (provider.name !== "simulated") {
        provider = new SimulatedSmsProvider();
      }
    }

    return await provider.send({
      ...msg,
      to: phone,
    });
  }

  /**
   * Generates and dispatches a test reminder with neutral, truthful phrasing.
   */
  static async sendTestReminder(params: {
    household_id?: string;
    to?: string;
    lang?: "en" | "hi" | "mr";
  }): Promise<SmsResult> {
    if (!params.household_id && !params.to) {
      throw new SmsServiceError(
        "A valid household ID or recipient phone number is required to send a test reminder.",
        "HOUSEHOLD_REQUIRED",
        400
      );
    }

    const lang = params.lang || "en";

    const messages = {
      en: "SchemeSaathi Reminder: Your document renewal / scheme application verification is pending. Please visit your local taluka or government office with your documents.",
      hi: "योजनासाथी सूचना: आपका दस्तावेज नवीनीकरण अथवा योजना आवेदन सत्यापन लंबित है। कृपया अपने दस्तावेजों के साथ स्थानीय तहसील या सरकारी कार्यालय में संपर्क करें।",
      mr: "योजनासाथी सूचना: आपले दस्तऐवज नूतनीकरण अथवा योजना अर्ज पडताळणी प्रलंबित आहे. कृपया आपल्या आवश्यक कागदपत्रांसह स्थानिक तहसील अथवा शासकीय कार्यालयास भेट द्या.",
    };

    const message = messages[lang] || messages.en;

    return await this.sendSms({
      household_id: params.household_id,
      to: params.to || "",
      message,
      metadata: { type: "test_reminder", lang },
    });
  }

  /**
   * Retrieves simulated SMS messages, optionally filtered by household_id.
   */
  static async getSimulatedMessages(options: { household_id?: string; limit?: number } = {}) {
    const limit = options.limit || 50;
    try {
      if (options.household_id) {
        return await db
          .select()
          .from(schema.simulatedSmsMessages)
          .where(eq(schema.simulatedSmsMessages.household_id, options.household_id))
          .orderBy(desc(schema.simulatedSmsMessages.created_at))
          .limit(limit);
      }

      return await db
        .select()
        .from(schema.simulatedSmsMessages)
        .orderBy(desc(schema.simulatedSmsMessages.created_at))
        .limit(limit);
    } catch {
      return [];
    }
  }

  /**
   * Clears simulated inbox messages.
   */
  static async clearSimulatedMessages(): Promise<number> {
    try {
      const rows = await db.select({ id: schema.simulatedSmsMessages.id }).from(schema.simulatedSmsMessages);
      await db.delete(schema.simulatedSmsMessages);
      return rows.length;
    } catch {
      return 0;
    }
  }
}
