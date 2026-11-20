import { eq, inArray, and } from "drizzle-orm";
import crypto from "crypto";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { EligibilityService } from "../eligibility/service.js";
import { AnswersService } from "./answers-service.js";
import { ConsentService } from "./consent-service.js";

export class HouseholdService {
  static async createHousehold(data: {
    consent_given?: boolean;
    district_id?: string;
    taluka?: string;
    state?: string;
  }) {
    const householdId = `hh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const access_secret = `sec_${crypto.randomBytes(24).toString("hex")}`;
    const access_secret_hash = crypto.createHash("sha256").update(access_secret).digest("hex");

    await db.insert(schema.households).values({
      household_id: householdId,
      consent_given: data.consent_given ?? true,
      district_id: data.district_id,
      taluka: data.taluka,
      state: data.state || "Maharashtra",
      access_secret_hash,
    });

    const created = await db
      .select()
      .from(schema.households)
      .where(eq(schema.households.household_id, householdId))
      .limit(1);

    return {
      ...created[0],
      access_secret,
    };
  }

  static async claimHousehold(data: {
    household_id?: string;
    answers: Record<string, unknown>;
    consent?: {
      data_processing?: boolean;
      sms_reminders?: boolean;
      volunteer_assist?: boolean;
    };
    district_id?: string;
    taluka?: string;
    state?: string;
    lang?: "en" | "hi" | "mr";
  }) {
    AnswersService.assertNoSensitiveId(data.answers);

    const access_secret = `sec_${crypto.randomBytes(24).toString("hex")}`;
    const access_secret_hash = crypto.createHash("sha256").update(access_secret).digest("hex");

    let householdId = data.household_id;
    const districtId = data.district_id || (data.answers.district as string | undefined);
    const taluka = data.taluka || (data.answers.taluka as string | undefined);
    const state = data.state || (data.answers.residence_state as string | undefined) || "Maharashtra";
    const phone =
      (data.answers.phone_number as string | undefined) ||
      (data.answers.phone as string | undefined) ||
      (data.answers.contact_phone as string | undefined);

    if (householdId) {
      const existing = await db
        .select()
        .from(schema.households)
        .where(eq(schema.households.household_id, householdId))
        .limit(1);

      if (existing.length > 0 && existing[0]) {
        const currentHh = existing[0];
        await db
          .update(schema.households)
          .set({
            consent_given: data.consent?.data_processing ?? true,
            district_id: districtId || currentHh.district_id,
            taluka: taluka || currentHh.taluka,
            state: state || currentHh.state,
            contact_phone: phone || currentHh.contact_phone,
            access_secret_hash,
            updated_at: new Date(),
          })
          .where(eq(schema.households.household_id, householdId));
      } else {
        await db.insert(schema.households).values({
          household_id: householdId,
          consent_given: data.consent?.data_processing ?? true,
          district_id: districtId,
          taluka,
          state,
          contact_phone: phone,
          created_by_role: "citizen",
          access_secret_hash,
        });
      }
    } else {
      householdId = `hh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await db.insert(schema.households).values({
        household_id: householdId,
        consent_given: data.consent?.data_processing ?? true,
        district_id: districtId,
        taluka,
        state,
        contact_phone: phone,
        created_by_role: "citizen",
        access_secret_hash,
      });
    }

    const existingMembers = await db
      .select()
      .from(schema.householdMembers)
      .where(eq(schema.householdMembers.household_id, householdId));

    let memberId = existingMembers[0]?.member_id;
    if (!memberId) {
      memberId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await db.insert(schema.householdMembers).values({
        member_id: memberId,
        household_id: householdId,
        relation_to_head: "SELF",
        age: typeof data.answers.age === "number" ? data.answers.age : undefined,
        gender: typeof data.answers.gender === "string" ? data.answers.gender : undefined,
        occupation: typeof data.answers.occupation === "string" ? data.answers.occupation : undefined,
        caste_category: typeof data.answers.caste_category === "string" ? data.answers.caste_category : undefined,
        marital_status: typeof data.answers.marital_status === "string" ? data.answers.marital_status : undefined,
        answers: data.answers,
      });
    }

    for (const [key, val] of Object.entries(data.answers)) {
      await db.insert(schema.memberAnswers).values({
        household_id: householdId,
        member_id: memberId,
        attribute_key: key,
        value: val,
        source: "self_declared",
        status: "confirmed",
        updated_by_role: "citizen",
      });
    }

    if (data.consent?.data_processing !== false) {
      await ConsentService.recordConsent({
        household_id: householdId,
        purpose: "data_processing",
        lang: data.lang || "en",
      });
    }
    if (data.consent?.sms_reminders) {
      await ConsentService.recordConsent({
        household_id: householdId,
        purpose: "sms_reminders",
        lang: data.lang || "en",
      });
    }
    if (data.consent?.volunteer_assist) {
      await ConsentService.recordConsent({
        household_id: householdId,
        purpose: "volunteer_assist",
        lang: data.lang || "en",
      });
    }

    await ConsentService.recordDeclaration({
      household_id: householdId,
      lang: data.lang || "en",
    });

    const hh = await this.getHousehold(householdId);
    return {
      ...hh,
      household_id: householdId,
      access_secret,
    };
  }

  static async getHousehold(householdId: string) {
    const hh = await db
      .select()
      .from(schema.households)
      .where(eq(schema.households.household_id, householdId))
      .limit(1);
    if (!hh[0]) return null;

    const members = await db
      .select()
      .from(schema.householdMembers)
      .where(eq(schema.householdMembers.household_id, householdId));

    const docs = await db
      .select()
      .from(schema.householdDocuments)
      .where(eq(schema.householdDocuments.household_id, householdId));

    const storedAnswers = await db
      .select()
      .from(schema.memberAnswers)
      .where(
        and(
          eq(schema.memberAnswers.household_id, householdId),
          eq(schema.memberAnswers.status, "confirmed")
        )
      );

    const answersByMember = new Map<string, Record<string, unknown>>();
    const hhAnswers: Record<string, unknown> = {};

    for (const ans of storedAnswers) {
      if (ans.value !== null) {
        if (ans.member_id) {
          const mAns = answersByMember.get(ans.member_id) || {};
          mAns[ans.attribute_key] = ans.value;
          answersByMember.set(ans.member_id, mAns);
        } else {
          hhAnswers[ans.attribute_key] = ans.value;
        }
      }
    }

    const enrichedMembers = members.map((m) => ({
      ...m,
      answers: {
        ...hhAnswers,
        ...((m.answers as Record<string, unknown>) || {}),
        ...(answersByMember.get(m.member_id) || {}),
      },
    }));

    return {
      ...hh[0],
      members: enrichedMembers,
      documents: docs,
    };
  }

  static async addMember(
    householdId: string,
    data: {
      relation_to_head?: string;
      age?: number;
      gender?: string;
      occupation?: string;
      caste_category?: string;
      marital_status?: string;
      answers?: Record<string, unknown>;
    }
  ) {
    const memberId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.insert(schema.householdMembers).values({
      member_id: memberId,
      household_id: householdId,
      relation_to_head: data.relation_to_head || "SELF",
      age: data.age,
      gender: data.gender,
      occupation: data.occupation,
      caste_category: data.caste_category,
      marital_status: data.marital_status,
      answers: data.answers || {},
    });

    const mem = await db
      .select()
      .from(schema.householdMembers)
      .where(eq(schema.householdMembers.member_id, memberId))
      .limit(1);
    return mem[0];
  }

  static async updateDocumentStatus(
    householdId: string,
    documentId: string,
    data: {
      member_id?: string;
      status: "have" | "missing" | "expired";
      expires_on?: string;
      alt_used?: string;
      notes?: string;
    }
  ) {
    const docRecordId = `${householdId}_${data.member_id || "hh"}_${documentId}`;
    await db
      .insert(schema.householdDocuments)
      .values({
        id: docRecordId,
        household_id: householdId,
        member_id: data.member_id,
        document_id: documentId,
        status: data.status,
        expires_on: data.expires_on,
        alt_used: data.alt_used,
        notes: data.notes,
      })
      .onConflictDoUpdate({
        target: schema.householdDocuments.id,
        set: {
          status: data.status,
          expires_on: data.expires_on,
          alt_used: data.alt_used,
          notes: data.notes,
        },
      });

    return { success: true, id: docRecordId, status: data.status };
  }

  /**
   * Resolves prerequisites for a document recursively into an ordered "do this first" chain.
   */
  static async resolvePrerequisiteChain(documentId: string): Promise<string[]> {
    const chain: string[] = [];
    const visited = new Set<string>();

    async function traverse(currentDoc: string) {
      if (visited.has(currentDoc)) return;
      visited.add(currentDoc);

      const prereqs = await db
        .select()
        .from(schema.documentPrerequisites)
        .where(eq(schema.documentPrerequisites.document_id, currentDoc));

      for (const p of prereqs) {
        await traverse(p.requires_document_id);
        if (!chain.includes(p.requires_document_id)) {
          chain.push(p.requires_document_id);
        }
      }
    }

    await traverse(documentId);
    return chain;
  }

  /**
   * Generates document checklist for a specific scheme and household member.
   */
  static async getSchemeChecklist(
    householdId: string,
    schemeId: string,
    memberId?: string,
    lang: "en" | "hi" | "mr" = "en"
  ) {
    const sch = await db
      .select()
      .from(schema.schemes)
      .where(eq(schema.schemes.scheme_id, schemeId))
      .limit(1);

    if (!sch[0]) return null;

    const raw = sch[0].raw as Record<string, unknown>;
    const rawRequired = (raw.documents_required as Array<Record<string, unknown>>) || [];

    const existingDocs = await db
      .select()
      .from(schema.householdDocuments)
      .where(eq(schema.householdDocuments.household_id, householdId));

    const existingMap = new Map<string, typeof existingDocs[0]>();
    for (const d of existingDocs) {
      if (!memberId || d.member_id === memberId || !d.member_id) {
        existingMap.set(d.document_id, d);
      }
    }

    const items = [];
    for (const r of rawRequired) {
      const docId = String(r.document_id);
      const held = existingMap.get(docId);

      // Prerequisite expansion
      const prereqDocIds = await this.resolvePrerequisiteChain(docId);
      const prerequisiteChainDetails = [];

      for (const pid of prereqDocIds) {
        const meta = await db
          .select()
          .from(schema.documents)
          .where(eq(schema.documents.document_id, pid))
          .limit(1);

        const pHeld = existingMap.get(pid);
        prerequisiteChainDetails.push({
          document_id: pid,
          name: meta[0]?.official_document_name || pid,
          issuing_authority: meta[0]?.issuing_authority,
          portal: meta[0]?.application_portal,
          already_held: pHeld?.status === "have",
        });
      }

      // Fetch master metadata for this document
      const docMeta = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.document_id, docId))
        .limit(1);

      let explanation = docMeta[0]?.simple_explanation_en;
      if (lang === "mr" && docMeta[0]?.simple_explanation_mr) {
        explanation = docMeta[0].simple_explanation_mr;
      } else if (lang === "hi" && docMeta[0]?.simple_explanation_hi) {
        explanation = docMeta[0].simple_explanation_hi;
      }

      items.push({
        document_id: docId,
        official_name: docMeta[0]?.official_document_name || docId,
        explanation,
        mandatory: r.mandatory !== false,
        status: held?.status || "missing",
        expires_on: held?.expires_on,
        alt_used: held?.alt_used,
        alternatives: (r.alternative_documents as string[]) || [],
        issuing_authority: docMeta[0]?.issuing_authority,
        application_portal: docMeta[0]?.application_portal,
        prerequisite_chain: prerequisiteChainDetails,
      });
    }

    return {
      scheme_id: schemeId,
      household_id: householdId,
      member_id: memberId,
      documents: items,
    };
  }

  /**
   * Generates a deduplicated, prioritized document acquisition plan across all eligible schemes.
   */
  static async getDocumentPlan(householdId: string, lang: "en" | "hi" | "mr" = "en") {
    const hh = await this.getHousehold(householdId);
    if (!hh) return null;

    // Evaluate household eligibility across all schemes
    const evaluation = await EligibilityService.evaluate({
      household: {
        household_id: hh.household_id,
        district_id: hh.district_id || undefined,
        taluka: hh.taluka || undefined,
        state: hh.state || undefined,
      },
      members: hh.members.map((m) => ({
        member_id: m.member_id,
        relation_to_head: m.relation_to_head || undefined,
        age: m.age || undefined,
        gender: m.gender || undefined,
        occupation: m.occupation || undefined,
        caste_category: m.caste_category || undefined,
        marital_status: m.marital_status || undefined,
        answers: (m.answers as Record<string, unknown>) || {},
      })),
      lang,
    });

    const eligibleSchemeIds = new Set<string>();
    for (const memRes of evaluation.results) {
      for (const el of memRes.eligible) eligibleSchemeIds.add(el.scheme_id);
      for (const unk of memRes.unknown) eligibleSchemeIds.add(unk.scheme_id);
    }

    // Collect missing documents and compute schemes unlocked
    const missingDocsCount = new Map<string, { docId: string; unlockedSchemes: Set<string> }>();
    const existingDocMap = new Map(hh.documents.map((d) => [d.document_id, d.status]));

    // Load raw documents only for eligible/candidate schemes in chunks
    const targetIds = Array.from(eligibleSchemeIds);
    const matchedSchemesRaw = [];
    if (targetIds.length > 0) {
      for (let i = 0; i < targetIds.length; i += 50) {
        const chunk = targetIds.slice(i, i + 50);
        const rows = await db
          .select({ scheme_id: schema.schemes.scheme_id, raw: schema.schemes.raw })
          .from(schema.schemes)
          .where(inArray(schema.schemes.scheme_id, chunk));
        matchedSchemesRaw.push(...rows);
      }
    }
    const rawMap = new Map(matchedSchemesRaw.map((s) => [s.scheme_id, s.raw as Record<string, unknown>]));

    // Memoize prerequisite chains
    const prereqCache = new Map<string, string[]>();

    for (const schemeId of eligibleSchemeIds) {
      const raw = rawMap.get(schemeId);
      if (!raw) continue;
      const requiredDocs = (raw.documents_required as Array<Record<string, unknown>>) || [];

      for (const req of requiredDocs) {
        const dId = String(req.document_id);
        const status = existingDocMap.get(dId);
        if (status !== "have") {
          const entry = missingDocsCount.get(dId) || {
            docId: dId,
            unlockedSchemes: new Set<string>(),
          };
          entry.unlockedSchemes.add(schemeId);
          missingDocsCount.set(dId, entry);

          // Add prerequisites with memoization
          if (!prereqCache.has(dId)) {
            prereqCache.set(dId, await this.resolvePrerequisiteChain(dId));
          }
          const prereqIds = prereqCache.get(dId)!;
          for (const pid of prereqIds) {
            if (existingDocMap.get(pid) !== "have") {
              const pEntry = missingDocsCount.get(pid) || {
                docId: pid,
                unlockedSchemes: new Set<string>(),
              };
              pEntry.unlockedSchemes.add(schemeId);
              missingDocsCount.set(pid, pEntry);
            }
          }
        }
      }
    }

    // Pre-load all documents metadata once
    const allDocMetas = await db.select().from(schema.documents);
    const docMetaMap = new Map(allDocMetas.map((d) => [d.document_id, d]));

    // Sort documents: prerequisites first, then highest schemes unlocked
    const planItems = [];
    for (const item of missingDocsCount.values()) {
      const docMeta = docMetaMap.get(item.docId);

      let explanation = docMeta?.simple_explanation_en;
      if (lang === "mr" && docMeta?.simple_explanation_mr) {
        explanation = docMeta.simple_explanation_mr;
      } else if (lang === "hi" && docMeta?.simple_explanation_hi) {
        explanation = docMeta.simple_explanation_hi;
      }

      planItems.push({
        document_id: item.docId,
        official_name: docMeta?.official_document_name || item.docId,
        explanation,
        issuing_authority: docMeta?.issuing_authority,
        application_portal: docMeta?.application_portal,
        schemes_unlocked_count: item.unlockedSchemes.size,
        schemes_unlocked: Array.from(item.unlockedSchemes),
      });
    }

    planItems.sort((a, b) => b.schemes_unlocked_count - a.schemes_unlocked_count);

    return {
      household_id: householdId,
      eligible_schemes_count: eligibleSchemeIds.size,
      missing_documents_count: planItems.length,
      document_plan: planItems,
    };
  }
}
