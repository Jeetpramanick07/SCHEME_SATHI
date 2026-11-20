import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDb, closeDb, db } from "../src/db/index.js";
import { buildServer } from "../src/server.js";
import { FastifyInstance } from "fastify";
import * as schema from "../src/db/schema.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { config } from "../src/config.js";
import { SmsService } from "../src/modules/sms/service.js";
import { SimulatedSmsProvider } from "../src/modules/sms/providers/simulated.js";
import { Msg91SmsProvider } from "../src/modules/sms/providers/msg91.js";
import { TwilioSmsProvider } from "../src/modules/sms/providers/twilio.js";

describe("SMS Gateway & Simulated Inbox Suite", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    await initDb();
    server = await buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    await closeDb();
  });

  it("defaults to SIMULATED provider and degrades cleanly with simulated_fallback for unconfigured external providers", async () => {
    // 1. Default provider is simulated
    delete process.env.SMS_PROVIDER;
    SmsService.setProvider(null);
    const provider = SmsService.getProvider();
    expect(provider.name).toBe("simulated");

    // 2. Unconfigured MSG91 falls back to simulated delivery cleanly with simulated_fallback status
    const msg91 = new Msg91SmsProvider();
    const msg91Res = await msg91.send({
      to: "9876500001",
      message: "Test fallback message",
    });
    expect(msg91Res.success).toBe(true);
    expect(msg91Res.simulated).toBe(true);
    expect(msg91Res.status).toBe("simulated_fallback");

    // 3. Unconfigured Twilio falls back to simulated delivery cleanly with simulated_fallback status
    const twilio = new TwilioSmsProvider();
    const twilioRes = await twilio.send({
      to: "9876500002",
      message: "Test fallback message",
    });
    expect(twilioRes.success).toBe(true);
    expect(twilioRes.simulated).toBe(true);
    expect(twilioRes.status).toBe("simulated_fallback");

    // Reset back to simulated provider
    SmsService.setProvider(new SimulatedSmsProvider());
  });

  it("strictly respects consent: rejects SMS when consent is missing or withdrawn", async () => {
    const testHhNoConsent = `hh_test_no_consent_${Date.now()}`;

    // 1. Create household without sms_reminders consent
    await db.insert(schema.households).values({
      household_id: testHhNoConsent,
      contact_phone: "9876543210",
      state: "Maharashtra",
    });

    try {
      // Attempt to send test reminder -> must fail with 403 CONSENT_REQUIRED
      const resNoConsent = await server.inject({
        method: "POST",
        url: "/api/v1/sms/send-test",
        payload: {
          household_id: testHhNoConsent,
        },
      });

      expect(resNoConsent.statusCode).toBe(403);
      const errNoConsent = JSON.parse(resNoConsent.body);
      expect(errNoConsent.error.code).toBe("CONSENT_REQUIRED");

      // 2. Grant consent then withdraw it
      const [consentRow] = await db
        .insert(schema.consentRecords)
        .values({
          household_id: testHhNoConsent,
          purpose: "sms_reminders",
        })
        .returning();

      // Withdraw consent
      await db
        .update(schema.consentRecords)
        .set({ withdrawn_at: new Date() })
        .where(eq(schema.consentRecords.id, consentRow.id));

      // Attempt to send test reminder again -> must still be 403 CONSENT_REQUIRED
      const resWithdrawn = await server.inject({
        method: "POST",
        url: "/api/v1/sms/send-test",
        payload: {
          household_id: testHhNoConsent,
        },
      });

      expect(resWithdrawn.statusCode).toBe(403);
      const errWithdrawn = JSON.parse(resWithdrawn.body);
      expect(errWithdrawn.error.code).toBe("CONSENT_REQUIRED");
    } finally {
      await db.delete(schema.consentRecords).where(eq(schema.consentRecords.household_id, testHhNoConsent));
      await db.delete(schema.households).where(eq(schema.households.household_id, testHhNoConsent));
    }
  });

  it("requires a valid 10-digit phone number and rejects missing or malformed numbers", async () => {
    // 1. Missing phone on ad-hoc request -> 400
    const resNoPhone = await server.inject({
      method: "POST",
      url: "/api/v1/sms/send-test",
      payload: {},
    });
    expect(resNoPhone.statusCode).toBe(400);
    const errNoPhone = JSON.parse(resNoPhone.body);
    expect(errNoPhone.error.code).toBe("PHONE_REQUIRED");

    // 2. Malformed / too short phone number -> 400
    const resShortPhone = await server.inject({
      method: "POST",
      url: "/api/v1/sms/send-test",
      payload: { to: "12345" },
    });
    expect(resShortPhone.statusCode).toBe(400);
    const errShortPhone = JSON.parse(resShortPhone.body);
    expect(errShortPhone.error.code).toBe("PHONE_REQUIRED");
  });

  it("strictly enforces truthful wording: rejects 'you will receive' or promissory wording with 422", async () => {
    const testHh = `hh_test_wording_${Date.now()}`;
    await db.insert(schema.households).values({
      household_id: testHh,
      contact_phone: "9876543210",
      state: "Maharashtra",
    });
    await db.insert(schema.consentRecords).values({
      household_id: testHh,
      purpose: "sms_reminders",
    });

    try {
      // 1. English: "you will receive"
      const resEn = await server.inject({
        method: "POST",
        url: "/api/v1/sms/send-test",
        payload: {
          household_id: testHh,
          message: "Congratulations! You will receive Rs 1500 in your account tomorrow.",
        },
      });
      expect(resEn.statusCode).toBe(422);
      expect(JSON.parse(resEn.body).error.code).toBe("FORBIDDEN_WORDING");

      // 2. Marathi: "तुम्हाला ... मिळेल"
      const resMr = await server.inject({
        method: "POST",
        url: "/api/v1/sms/send-test",
        payload: {
          household_id: testHh,
          message: "आपल्या खात्यामध्ये तुम्हाला दरमहा १५०० रुपये मिळेल.",
        },
      });
      expect(resMr.statusCode).toBe(422);
      expect(JSON.parse(resMr.body).error.code).toBe("FORBIDDEN_WORDING");

      // 3. Hindi: "आपको ... मिलेगा"
      const resHi = await server.inject({
        method: "POST",
        url: "/api/v1/sms/send-test",
        payload: {
          household_id: testHh,
          message: "आपको इस योजना के तहत वित्तीय सहायता मिलेगा.",
        },
      });
      expect(resHi.statusCode).toBe(422);
      expect(JSON.parse(resHi.body).error.code).toBe("FORBIDDEN_WORDING");

      // 4. Truthful neutral message succeeds
      const resValid = await server.inject({
        method: "POST",
        url: "/api/v1/sms/send-test",
        payload: {
          household_id: testHh,
          message: "SchemeSaathi Reminder: Your document renewal is pending. Please visit the local authority office.",
        },
      });
      expect(resValid.statusCode).toBe(200);
      const dataValid = JSON.parse(resValid.body);
      expect(dataValid.success).toBe(true);
      expect(dataValid.result.status).toBe("simulated_delivered");
    } finally {
      await db.delete(schema.consentRecords).where(eq(schema.consentRecords.household_id, testHh));
      await db.delete(schema.households).where(eq(schema.households.household_id, testHh));
    }
  });

  it("stores simulated messages in database, enforces role authorization for GET/DELETE, and citizen privacy with X-Household-Secret", async () => {
    // 1. Clear simulated inbox first using admin key
    const clearResAdmin = await server.inject({
      method: "DELETE",
      url: "/api/v1/sms/simulated",
      headers: {
        "x-api-key": config.apiKeyAdmin,
      },
    });
    expect(clearResAdmin.statusCode).toBe(200);

    // Verify unauthenticated / citizen DELETE is FORBIDDEN (403)
    const delCitizenNoKey = await server.inject({
      method: "DELETE",
      url: "/api/v1/sms/simulated",
    });
    expect(delCitizenNoKey.statusCode).toBe(403);

    const delCitizenKey = await server.inject({
      method: "DELETE",
      url: "/api/v1/sms/simulated",
      headers: {
        "x-api-key": config.apiKeyCitizen,
      },
    });
    expect(delCitizenKey.statusCode).toBe(403);

    // Volunteer DELETE succeeds
    const delVolunteerKey = await server.inject({
      method: "DELETE",
      url: "/api/v1/sms/simulated",
      headers: {
        "x-api-key": config.apiKeyVolunteer,
      },
    });
    expect(delVolunteerKey.statusCode).toBe(200);

    // 2. Create 2 distinct households with secrets
    const testHhA = `hh_test_sim_a_${Date.now()}`;
    const testSecretA = `sec_a_${Date.now()}`;
    const hashA = crypto.createHash("sha256").update(testSecretA).digest("hex");

    const testHhB = `hh_test_sim_b_${Date.now()}`;
    const testSecretB = `sec_b_${Date.now()}`;
    const hashB = crypto.createHash("sha256").update(testSecretB).digest("hex");

    await db.insert(schema.households).values([
      {
        household_id: testHhA,
        contact_phone: "9876511111",
        access_secret_hash: hashA,
        state: "Maharashtra",
      },
      {
        household_id: testHhB,
        contact_phone: "9876522222",
        access_secret_hash: hashB,
        state: "Maharashtra",
      },
    ]);

    await db.insert(schema.consentRecords).values([
      {
        household_id: testHhA,
        purpose: "sms_reminders",
      },
      {
        household_id: testHhB,
        purpose: "sms_reminders",
      },
    ]);

    try {
      // Send reminder to Household A
      const sendA = await server.inject({
        method: "POST",
        url: "/api/v1/sms/send-test",
        payload: {
          household_id: testHhA,
          lang: "mr",
        },
      });
      expect(sendA.statusCode).toBe(200);

      // Send reminder to Household B
      const sendB = await server.inject({
        method: "POST",
        url: "/api/v1/sms/send-test",
        payload: {
          household_id: testHhB,
          lang: "en",
        },
      });
      expect(sendB.statusCode).toBe(200);

      // 3. Citizen GET without X-Household-Secret must return 403 FORBIDDEN
      const getCitizenNoSecret = await server.inject({
        method: "GET",
        url: "/api/v1/sms/simulated",
      });
      expect(getCitizenNoSecret.statusCode).toBe(403);

      // 4. Citizen with secret for Household A sees ONLY Household A's messages
      const getCitizenA = await server.inject({
        method: "GET",
        url: "/api/v1/sms/simulated",
        headers: {
          "x-household-secret": testSecretA,
        },
      });
      expect(getCitizenA.statusCode).toBe(200);
      const dataA = JSON.parse(getCitizenA.body);
      expect(dataA.count).toBe(1);
      expect(dataA.messages[0].household_id).toBe(testHhA);
      expect(dataA.messages[0].phone).toBe("9876511111");

      // 5. Citizen with secret for Household A attempting to view Household B's messages is FORBIDDEN (403)
      const getCitizenAMisbehave = await server.inject({
        method: "GET",
        url: `/api/v1/sms/simulated?household_id=${testHhB}`,
        headers: {
          "x-household-secret": testSecretA,
        },
      });
      expect(getCitizenAMisbehave.statusCode).toBe(403);

      // 6. Admin key sees all messages across households
      const getAdmin = await server.inject({
        method: "GET",
        url: "/api/v1/sms/simulated",
        headers: {
          "x-api-key": config.apiKeyAdmin,
        },
      });
      expect(getAdmin.statusCode).toBe(200);
      const dataAdmin = JSON.parse(getAdmin.body);
      expect(dataAdmin.count).toBeGreaterThanOrEqual(2);

      // 7. Volunteer key sees all messages across households
      const getVolunteer = await server.inject({
        method: "GET",
        url: "/api/v1/sms/simulated",
        headers: {
          "x-api-key": config.apiKeyVolunteer,
        },
      });
      expect(getVolunteer.statusCode).toBe(200);
      const dataVolunteer = JSON.parse(getVolunteer.body);
      expect(dataVolunteer.count).toBeGreaterThanOrEqual(2);
    } finally {
      await db.delete(schema.simulatedSmsMessages).where(eq(schema.simulatedSmsMessages.household_id, testHhA));
      await db.delete(schema.simulatedSmsMessages).where(eq(schema.simulatedSmsMessages.household_id, testHhB));
      await db.delete(schema.consentRecords).where(eq(schema.consentRecords.household_id, testHhA));
      await db.delete(schema.consentRecords).where(eq(schema.consentRecords.household_id, testHhB));
      await db.delete(schema.households).where(eq(schema.households.household_id, testHhA));
      await db.delete(schema.households).where(eq(schema.households.household_id, testHhB));
    }
  });

  // 8. SMS Safety: synthetic households must NEVER be sent through external providers (msg91/twilio)
  it("SMS Safety: synthetic households (is_synthetic=true) are forced to SIMULATED provider even when external provider is active", async () => {
    const testSynthHh = `hh_synth_test_safety_${Date.now()}`;
    const testPhone = "9876543210";

    // Create synthetic household
    await db.insert(schema.households).values({
      household_id: testSynthHh,
      contact_phone: testPhone,
      state: "Maharashtra",
      is_synthetic: true,
    });

    // Grant SMS consent
    await db.insert(schema.consentRecords).values({
      household_id: testSynthHh,
      purpose: "sms_reminders",
    });

    try {
      // Configure MSG91 external provider
      const fakeMsg91 = new Msg91SmsProvider();
      SmsService.setProvider(fakeMsg91);

      // Attempt to send SMS for synthetic household
      const result = await SmsService.sendSms({
        household_id: testSynthHh,
        message: "SchemeSaathi Reminder: Your document renewal is pending. Please visit the local taluka office.",
      });

      // Assert that synthetic household was FORCED to simulated provider
      expect(result.simulated).toBe(true);
      expect(result.provider).toBe("simulated");

      // Verify that message is safely stored in simulated_sms_messages
      const [logged] = await db
        .select()
        .from(schema.simulatedSmsMessages)
        .where(eq(schema.simulatedSmsMessages.household_id, testSynthHh));

      expect(logged).toBeDefined();
      expect(logged.provider).toBe("simulated");
      expect(logged.status).toBe("simulated_delivered");
    } finally {
      // Reset provider
      SmsService.setProvider(new SimulatedSmsProvider());
      await db.delete(schema.simulatedSmsMessages).where(eq(schema.simulatedSmsMessages.household_id, testSynthHh));
      await db.delete(schema.consentRecords).where(eq(schema.consentRecords.household_id, testSynthHh));
      await db.delete(schema.households).where(eq(schema.households.household_id, testSynthHh));
    }
  });

  // 9. POST /sms/send-test refuses when no household or recipient is specified
  it("POST /sms/send-test refuses with 400 when no household or phone is provided", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/sms/send-test",
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const err = JSON.parse(res.body);
    expect(err.error.code).toMatch(/PHONE_REQUIRED|HOUSEHOLD_REQUIRED/);
  });
});
