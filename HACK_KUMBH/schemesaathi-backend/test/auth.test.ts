import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../src/server.js";
import { initDb, closeDb } from "../src/db/index.js";
import { FastifyInstance } from "fastify";

describe("User Account and Profile Suite", () => {
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

  const testUser = `citizen_${Date.now()}`;
  let registeredUserId: string;
  let householdId: string;
  let accessSecret: string;

  it("1. Registers a new citizen user with isolated household and member", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        username: testUser,
        password: "securePassword123",
        full_name: "आनंद तुकाराम मेश्राम",
        phone: "9876543211",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.user).toBeDefined();
    expect(body.user.username).toBe(testUser);
    expect(body.user.full_name).toBe("आनंद तुकाराम मेश्राम");
    expect(body.user.household_id).toBeDefined();
    expect(body.user.member_id).toBeDefined();
    expect(body.household.access_secret).toBeDefined();
    expect(body.user.profile_completed).toBe(false);

    registeredUserId = body.user.id;
    householdId = body.user.household_id;
    accessSecret = body.household.access_secret;
  });

  it("2. Rejects duplicate username with 409 Conflict", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        username: testUser,
        password: "anotherPassword",
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("USER_ALREADY_EXISTS");
  });

  it("3. Logs in the user with correct password and refreshes access secret", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        username: testUser,
        password: "securePassword123",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user.id).toBe(registeredUserId);
    expect(body.household.household_id).toBe(householdId);
    expect(body.household.access_secret).toBeDefined();
  });

  it("4. Rejects invalid credentials with 401 Unauthorized", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        username: testUser,
        password: "wrongPassword",
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("5. Fetches verified details from DigiLocker simulation", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/auth/digilocker-fetch",
      payload: {
        user_id: registeredUserId,
        household_id: householdId,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.digilocker_verified).toBe(true);
    expect(body.data.masked_aadhaar).toBe("XXXX-XXXX-8921");
    expect(body.data.age).toBe(62);
    expect(body.data.district).toBe("Nagpur");
  });

  it("6. Rejects 12-digit raw Aadhaar numbers to ensure zero ID leaks", async () => {
    const res = await server.inject({
      method: "PUT",
      url: "/api/v1/user-profile",
      payload: {
        user_id: registeredUserId,
        household_id: householdId,
        answers: {
          aadhaar: "2345 6789 0123", // Raw 12-digit Aadhaar violation
        },
      },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("SENSITIVE_ID_NOT_ALLOWED");
  });

  it("7. Updates user profile and marks profile_completed = true when core fields filled", async () => {
    const res = await server.inject({
      method: "PUT",
      url: "/api/v1/user-profile",
      payload: {
        user_id: registeredUserId,
        household_id: householdId,
        full_name: "आनंद तुकाराम मेश्राम",
        phone: "9876543211",
        masked_aadhaar: "XXXX-XXXX-8921",
        answers: {
          age: 62,
          gender: "FEMALE",
          district: "Nagpur",
          district_id: "DIST_MH_NGP",
          taluka: "Nagpur Urban",
          marital_status: "widowed",
          is_widow: true,
          caste_category: "SC",
          annual_family_income: 45000,
          occupation: "agricultural_labour",
          ration_card_type: "yellow_bpl",
          belongs_to_bpl_household: true,
          years_in_maharashtra_gte: 25,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.completion_percentage).toBeGreaterThanOrEqual(70);
    expect(body.is_complete).toBe(true);

    // Verify GET /user-profile
    const getRes = await server.inject({
      method: "GET",
      url: `/api/v1/user-profile?user_id=${registeredUserId}`,
    });
    expect(getRes.statusCode).toBe(200);
    const profile = JSON.parse(getRes.body);
    expect(profile.completion_percentage).toBeGreaterThanOrEqual(70);
    expect(profile.is_complete).toBe(true);
    expect(profile.answers.age).toBe(62);
  });
});
