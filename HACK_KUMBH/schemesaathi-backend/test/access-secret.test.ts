import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../src/server.js";
import { initDb, closeDb, db } from "../src/db/index.js";
import { IngestionPipeline } from "../src/ingest/pipeline.js";
import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema.js";

describe("Household Access Secret & Authorization Suite", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    await initDb();
    await IngestionPipeline.ingest("data/government_welfare_schemes.json");
    server = await buildServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    await closeDb();
  });

  it("claims household, returns access_secret, stores sha256 hash at rest, and guards citizen endpoints", async () => {
    // 1. Claim household
    const claimRes = await server.inject({
      method: "POST",
      url: "/api/v1/households/claim",
      payload: {
        district_id: "DIST_MH_NGP",
        taluka: "Nagpur Urban",
        state: "Maharashtra",
        answers: {
          age: 62,
          gender: "FEMALE",
          widow: true,
          bpl_card: true,
        },
      },
    });

    expect(claimRes.statusCode).toBe(201);
    const claimData = JSON.parse(claimRes.body);
    const householdId = claimData.household_id;
    const accessSecret = claimData.access_secret;

    expect(householdId).toBeDefined();
    expect(accessSecret).toBeDefined();
    expect(accessSecret.startsWith("sec_")).toBe(true);

    // 2. Verify hash stored at rest
    const [hhRow] = await db
      .select({ hash: schema.households.access_secret_hash })
      .from(schema.households)
      .where(eq(schema.households.household_id, householdId));

    expect(hhRow).toBeDefined();
    expect(hhRow.hash).toBeDefined();
    expect(hhRow.hash).not.toBe(accessSecret); // never stored in plaintext
    const expectedHash = crypto.createHash("sha256").update(accessSecret).digest("hex");
    expect(hhRow.hash).toBe(expectedHash);

    // 3. Citizen request with missing X-Household-Secret -> 403
    const missingSecretRes = await server.inject({
      method: "GET",
      url: `/api/v1/households/${householdId}/profile?lang=en`,
    });
    expect(missingSecretRes.statusCode).toBe(403);
    const missingErr = JSON.parse(missingSecretRes.body);
    expect(missingErr.error.code).toBe("FORBIDDEN");

    // 4. Citizen request with wrong X-Household-Secret -> 403
    const wrongSecretRes = await server.inject({
      method: "GET",
      url: `/api/v1/households/${householdId}/profile?lang=en`,
      headers: {
        "x-household-secret": "sec_invalid_wrong_secret",
      },
    });
    expect(wrongSecretRes.statusCode).toBe(403);
    const wrongErr = JSON.parse(wrongSecretRes.body);
    expect(wrongErr.error.code).toBe("FORBIDDEN");

    // 5. Citizen request with correct X-Household-Secret -> 200
    const validSecretRes = await server.inject({
      method: "GET",
      url: `/api/v1/households/${householdId}/profile?lang=en`,
      headers: {
        "x-household-secret": accessSecret,
      },
    });
    expect(validSecretRes.statusCode).toBe(200);

    // 6. Volunteer key bypasses X-Household-Secret
    const volunteerRes = await server.inject({
      method: "GET",
      url: `/api/v1/households/${householdId}/profile?lang=en`,
      headers: {
        "x-api-key": "volunteer-secret-key",
      },
    });
    expect(volunteerRes.statusCode).toBe(200);

    // 7. Admin key bypasses X-Household-Secret
    const adminRes = await server.inject({
      method: "GET",
      url: `/api/v1/households/${householdId}/profile?lang=en`,
      headers: {
        "x-api-key": "admin-secret-key",
      },
    });
    expect(adminRes.statusCode).toBe(200);

    // 8. Delete requires the secret
    // 8a. Delete with wrong secret -> 403
    const deleteWrongRes = await server.inject({
      method: "DELETE",
      url: `/api/v1/households/${householdId}`,
      headers: {
        "x-household-secret": "sec_wrong_to_delete",
      },
    });
    expect(deleteWrongRes.statusCode).toBe(403);

    // 8b. Delete with missing secret -> 403
    const deleteMissingRes = await server.inject({
      method: "DELETE",
      url: `/api/v1/households/${householdId}`,
    });
    expect(deleteMissingRes.statusCode).toBe(403);

    // 8c. Delete with valid secret -> 200
    const deleteValidRes = await server.inject({
      method: "DELETE",
      url: `/api/v1/households/${householdId}`,
      headers: {
        "x-household-secret": accessSecret,
      },
    });
    expect(deleteValidRes.statusCode).toBe(200);
  });

  it("proves a household row with null access_secret_hash returns 403 for citizen keys", async () => {
    const legacyHhId = `hh_legacy_null_hash_${Date.now()}`;

    // 1. Insert a household row with explicit null access_secret_hash
    await db.insert(schema.households).values({
      household_id: legacyHhId,
      district_id: "DIST_MH_NGP",
      taluka: "Nagpur Urban",
      state: "Maharashtra",
      access_secret_hash: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    try {
      // 2. Citizen request without secret header -> 403
      const reqNoSecret = await server.inject({
        method: "GET",
        url: `/api/v1/households/${legacyHhId}/profile?lang=en`,
      });
      expect(reqNoSecret.statusCode).toBe(403);
      const errNoSecret = JSON.parse(reqNoSecret.body);
      expect(errNoSecret.error.code).toBe("FORBIDDEN");

      // 3. Citizen request with an asserted secret -> 403 (hash of secret cannot match null)
      const reqWithSecret = await server.inject({
        method: "GET",
        url: `/api/v1/households/${legacyHhId}/profile?lang=en`,
        headers: {
          "x-household-secret": "sec_attempted_bypass_12345",
        },
      });
      expect(reqWithSecret.statusCode).toBe(403);
      const errWithSecret = JSON.parse(reqWithSecret.body);
      expect(errWithSecret.error.code).toBe("FORBIDDEN");

      // 4. Citizen DELETE request -> 403
      const reqDelete = await server.inject({
        method: "DELETE",
        url: `/api/v1/households/${legacyHhId}`,
        headers: {
          "x-household-secret": "sec_attempted_bypass_12345",
        },
      });
      expect(reqDelete.statusCode).toBe(403);
    } finally {
      // Cleanup
      await db.delete(schema.households).where(eq(schema.households.household_id, legacyHhId));
    }
  });
});
