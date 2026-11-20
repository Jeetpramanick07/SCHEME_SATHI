import { FastifyPluginAsync } from "fastify";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { AnswersService } from "../households/answers-service.js";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, combined: string): boolean {
  try {
    const [salt, key] = combined.split(":");
    if (!salt || !key) return false;
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(key, "hex"));
  } catch {
    return false;
  }
}

const RegisterSchema = z.object({
  username: z.string().min(3).max(128),
  password: z.string().min(4).max(128),
  full_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const DigiLockerFetchSchema = z.object({
  user_id: z.string().optional(),
  household_id: z.string().optional(),
  member_id: z.string().optional(),
});

const UpdateProfileSchema = z.object({
  user_id: z.string().optional(),
  household_id: z.string().optional(),
  member_id: z.string().optional(),
  full_name: z.string().optional(),
  phone: z.string().optional(),
  masked_aadhaar: z.string().optional(),
  answers: z.record(z.unknown()).default({}),
});

const CORE_FIELDS = [
  "full_name",
  "age",
  "gender",
  "district",
  "marital_status",
  "caste_category",
  "annual_family_income",
  "occupation",
  "ration_card_type",
  "masked_aadhaar",
];

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Helper to ensure demo user exists
  const ensureDemoUser = async () => {
    try {
      const existing = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.username, "widow_nagpur"))
        .limit(1);

      if (existing.length === 0) {
        const hhId = "hh_demo_widow";
        const memId = "mem_demo_widow";
        const secret = "sec_demo_widow_secret_12345";
        const secretHash = crypto.createHash("sha256").update(secret).digest("hex");

        await db
          .insert(schema.households)
          .values({
            household_id: hhId,
            district_id: "DIST_MH_NGP",
            taluka: "Nagpur Urban",
            state: "Maharashtra",
            consent_given: true,
            created_by_role: "citizen",
            access_secret_hash: secretHash,
          })
          .onConflictDoNothing();

        await db
          .insert(schema.householdMembers)
          .values({
            member_id: memId,
            household_id: hhId,
            relation_to_head: "SELF",
            age: 62,
            gender: "FEMALE",
            occupation: "agricultural_labour",
            caste_category: "SC",
            marital_status: "widowed",
            answers: {
              age: 62,
              gender: "FEMALE",
              marital_status: "widowed",
              is_widow: true,
              caste_category: "SC",
              district: "Nagpur",
              annual_family_income: 48000,
              occupation: "agricultural_labour",
              ration_card_type: "yellow_bpl",
              belongs_to_bpl_household: true,
              years_in_maharashtra_gte: 25,
            },
          })
          .onConflictDoNothing();

        await db
          .insert(schema.users)
          .values({
            id: "usr_demo_widow",
            username: "widow_nagpur",
            password_hash: hashPassword("pass123"),
            full_name: "सुनीता नामदेव गायकवाड",
            phone: "9876543210",
            household_id: hhId,
            member_id: memId,
            role: "citizen",
            profile_completed: true,
            digilocker_linked: true,
            masked_aadhaar: "XXXX-XXXX-8921",
          })
          .onConflictDoNothing();
      }
    } catch {
      // ignore
    }
  };

  // Run ensureDemoUser once
  ensureDemoUser();

  // POST /api/v1/auth/register
  fastify.post("/auth/register", async (request, reply) => {
    const body = RegisterSchema.parse(request.body);
    const username = body.username.trim().toLowerCase();

    // Check if username already exists
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (existing.length > 0) {
      return reply.status(409).send({
        error: {
          code: "USER_ALREADY_EXISTS",
          message: "Username or phone already registered. Please login.",
        },
      });
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const householdId = `hh_${userId}`;
    const memberId = `mem_${userId}`;
    const accessSecret = `sec_${crypto.randomBytes(24).toString("hex")}`;
    const accessSecretHash = crypto.createHash("sha256").update(accessSecret).digest("hex");

    // Create household
    await db.insert(schema.households).values({
      household_id: householdId,
      consent_given: true,
      state: "Maharashtra",
      district_id: "DIST_MH_NGP",
      taluka: "Nagpur Urban",
      created_by_role: "citizen",
      access_secret_hash: accessSecretHash,
      contact_phone: body.phone,
    });

    // Create primary member
    await db.insert(schema.householdMembers).values({
      member_id: memberId,
      household_id: householdId,
      relation_to_head: "SELF",
      answers: {},
    });

    const pwdHash = hashPassword(body.password);

    await db.insert(schema.users).values({
      id: userId,
      username,
      password_hash: pwdHash,
      full_name: body.full_name || username,
      phone: body.phone,
      email: body.email,
      household_id: householdId,
      member_id: memberId,
      role: "citizen",
      profile_completed: false,
      digilocker_linked: false,
    });

    const user = {
      id: userId,
      username,
      full_name: body.full_name || username,
      phone: body.phone,
      email: body.email,
      household_id: householdId,
      member_id: memberId,
      role: "citizen",
      profile_completed: false,
      digilocker_linked: false,
      masked_aadhaar: null,
    };

    return reply.status(201).send({
      token: `token_${userId}`,
      user,
      household: {
        household_id: householdId,
        member_id: memberId,
        access_secret: accessSecret,
      },
    });
  });

  // POST /api/v1/auth/login
  fastify.post("/auth/login", async (request, reply) => {
    const body = LoginSchema.parse(request.body);
    const username = body.username.trim().toLowerCase();

    // Ensure demo user exists in case it was requested
    if (username === "widow_nagpur") {
      await ensureDemoUser();
    }

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (!user || !verifyPassword(body.password, user.password_hash)) {
      return reply.status(401).send({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid ID/username or password. Please try again.",
        },
      });
    }

    // Refresh access secret for household
    const newAccessSecret = `sec_${crypto.randomBytes(24).toString("hex")}`;
    const newAccessSecretHash = crypto.createHash("sha256").update(newAccessSecret).digest("hex");

    await db
      .update(schema.households)
      .set({ access_secret_hash: newAccessSecretHash })
      .where(eq(schema.households.household_id, user.household_id));

    return reply.send({
      token: `token_${user.id}`,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        phone: user.phone,
        email: user.email,
        household_id: user.household_id,
        member_id: user.member_id,
        role: user.role,
        profile_completed: user.profile_completed,
        digilocker_linked: user.digilocker_linked,
        masked_aadhaar: user.masked_aadhaar,
      },
      household: {
        household_id: user.household_id,
        member_id: user.member_id,
        access_secret: newAccessSecret,
      },
    });
  });

  // GET /api/v1/auth/me
  fastify.get("/auth/me", async (request, reply) => {
    const userId = (request.headers["x-user-id"] as string) || (request.query as { user_id?: string })?.user_id;
    if (!userId) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "User not identified" } });
    }

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      return reply.status(404).send({ error: { code: "USER_NOT_FOUND", message: "User not found" } });
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        phone: user.phone,
        email: user.email,
        household_id: user.household_id,
        member_id: user.member_id,
        role: user.role,
        profile_completed: user.profile_completed,
        digilocker_linked: user.digilocker_linked,
        masked_aadhaar: user.masked_aadhaar,
      },
    };
  });

  // POST /api/v1/auth/digilocker-fetch
  fastify.post("/auth/digilocker-fetch", async (request, reply) => {
    const body = DigiLockerFetchSchema.parse(request.body || {});
    const userId = body.user_id || (request.headers["x-user-id"] as string);

    const digiData = {
      digilocker_verified: true,
      full_name: "सुनीता नामदेव गायकवाड (Sunita Namdev Gaikwad)",
      age: 62,
      gender: "FEMALE",
      marital_status: "widowed",
      is_widow: true,
      caste_category: "SC",
      district: "Nagpur",
      district_id: "DIST_MH_NGP",
      taluka: "Nagpur Urban",
      state: "Maharashtra",
      masked_aadhaar: "XXXX-XXXX-8921",
      ration_card_type: "yellow_bpl",
      belongs_to_bpl_household: true,
      annual_family_income: 48000,
      occupation: "agricultural_labour",
      years_in_maharashtra_gte: 25,
      has_aadhaar: true,
      has_bank_account: true,
      has_aadhaar_linked_bank: true,
      has_income_certificate: true,
      has_caste_certificate: true,
      has_domicile_certificate: true,
    };

    if (userId) {
      await db
        .update(schema.users)
        .set({
          digilocker_linked: true,
          masked_aadhaar: "XXXX-XXXX-8921",
          full_name: "सुनीता नामदेव गायकवाड",
          updated_at: new Date(),
        })
        .where(eq(schema.users.id, userId));
    }

    return reply.send({
      success: true,
      digilocker_verified: true,
      data: digiData,
    });
  });

  // GET /api/v1/user-profile
  fastify.get("/user-profile", async (request, reply) => {
    const userId = (request.headers["x-user-id"] as string) || (request.query as { user_id?: string })?.user_id;
    const householdIdParam = (request.query as { household_id?: string })?.household_id;

    let user: typeof schema.users.$inferSelect | undefined;

    if (userId) {
      const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      user = u;
    } else if (householdIdParam) {
      const [u] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.household_id, householdIdParam))
        .limit(1);
      user = u;
    }

    const hhId = user?.household_id || householdIdParam;
    let answers: Record<string, unknown> = {};

    if (hhId) {
      answers = await AnswersService.getConfirmedAnswers(hhId, user?.member_id);
    }

    // Merge in user fields
    if (user?.full_name && !answers.full_name) answers.full_name = user.full_name;
    if (user?.masked_aadhaar && !answers.masked_aadhaar) answers.masked_aadhaar = user.masked_aadhaar;

    // Calculate completion
    let answeredCount = 0;
    const missing: string[] = [];
    for (const f of CORE_FIELDS) {
      const val = answers[f] || (f === "full_name" ? user?.full_name : f === "masked_aadhaar" ? user?.masked_aadhaar : undefined);
      if (val !== undefined && val !== null && val !== "") {
        answeredCount++;
      } else {
        missing.push(f);
      }
    }

    const completionPercentage = Math.round((answeredCount / CORE_FIELDS.length) * 100);
    const isComplete = completionPercentage >= 70;

    return {
      user: user
        ? {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            phone: user.phone,
            household_id: user.household_id,
            member_id: user.member_id,
            role: user.role,
            profile_completed: isComplete,
            digilocker_linked: user.digilocker_linked,
            masked_aadhaar: user.masked_aadhaar,
          }
        : null,
      answers,
      completion_percentage: completionPercentage,
      missing_fields: missing,
      is_complete: isComplete,
    };
  });

  // PUT /api/v1/user-profile
  fastify.put("/user-profile", async (request, reply) => {
    const body = UpdateProfileSchema.parse(request.body);
    const userId = body.user_id || (request.headers["x-user-id"] as string);

    let user: typeof schema.users.$inferSelect | undefined;
    if (userId) {
      const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      user = u;
    }

    const householdId = body.household_id || user?.household_id;
    const memberId = body.member_id || user?.member_id;

    if (!householdId) {
      return reply.status(400).send({
        error: { code: "MISSING_HOUSEHOLD", message: "household_id is required to save profile." },
      });
    }

    // Guard against sensitive 12-digit Aadhaar
    AnswersService.assertNoSensitiveId(body.answers);
    if (body.masked_aadhaar) {
      AnswersService.assertNoSensitiveId(body.masked_aadhaar);
    }

    // Clean & update user table
    if (user) {
      await db
        .update(schema.users)
        .set({
          full_name: body.full_name || user.full_name,
          phone: body.phone || user.phone,
          masked_aadhaar: body.masked_aadhaar || user.masked_aadhaar,
          updated_at: new Date(),
        })
        .where(eq(schema.users.id, user.id));
    }

    // Save answers
    const answersToSave = { ...body.answers };
    if (body.full_name) answersToSave.full_name = body.full_name;
    if (body.masked_aadhaar) answersToSave.masked_aadhaar = body.masked_aadhaar;

    await AnswersService.patchAnswers(
      householdId,
      {
        answers: answersToSave,
        member_id: memberId,
        source: "self_declared",
      },
      { role: "citizen" }
    );

    // Re-check completion
    const allAnswers = await AnswersService.getConfirmedAnswers(householdId, memberId);
    let answeredCount = 0;
    const missing: string[] = [];
    for (const f of CORE_FIELDS) {
      const val = allAnswers[f] || (f === "full_name" ? body.full_name : f === "masked_aadhaar" ? body.masked_aadhaar : undefined);
      if (val !== undefined && val !== null && val !== "") {
        answeredCount++;
      } else {
        missing.push(f);
      }
    }

    const completionPercentage = Math.round((answeredCount / CORE_FIELDS.length) * 100);
    const isComplete = completionPercentage >= 70;

    if (user) {
      await db
        .update(schema.users)
        .set({
          profile_completed: isComplete,
        })
        .where(eq(schema.users.id, user.id));
    }

    return reply.send({
      success: true,
      completion_percentage: completionPercentage,
      missing_fields: missing,
      is_complete: isComplete,
    });
  });
};
