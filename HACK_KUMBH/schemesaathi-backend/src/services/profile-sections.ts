import fs from "fs";
import path from "path";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { validateConsistency } from "./consistency.js";

export const ProfileSectionFieldSeedSchema = z.object({
  attribute_key: z.string(),
  order: z.number().int(),
  optional: z.boolean().default(true),
});

export const ProfileSectionSeedSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  scope: z.enum(["household", "member"]).default("household"),
  title: z.object({
    en: z.string(),
    hi: z.string().optional(),
    mr: z.string().optional(),
  }),
  description: z
    .object({
      en: z.string().optional(),
      hi: z.string().optional(),
      mr: z.string().optional(),
    })
    .optional(),
  skippable: z.boolean().default(true),
  fields: z.array(ProfileSectionFieldSeedSchema),
});

export const ProfileSectionsFileSchema = z.array(ProfileSectionSeedSchema);

export class ProfileSectionsService {
  /**
   * Computes how many active schemes reference each attribute key.
   */
  static async computeAttributeSchemeCounts(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    try {
      const schemeRows = await db
        .select({ compiled_rules: schema.schemes.compiled_rules })
        .from(schema.schemes)
        .where(eq(schema.schemes.status, "ACTIVE"));

      for (const row of schemeRows) {
        if (!row.compiled_rules) continue;
        const compiled = row.compiled_rules as {
          rules?: Array<{ attribute: string }>;
          hard_filters?: Record<string, unknown>;
        };

        const seenInThisScheme = new Set<string>();

        if (Array.isArray(compiled.rules)) {
          for (const r of compiled.rules) {
            if (r.attribute) seenInThisScheme.add(r.attribute);
          }
        }

        // Include attributes implied by hard filters
        if (compiled.hard_filters) {
          if (compiled.hard_filters.min_age !== undefined || compiled.hard_filters.max_age !== undefined) {
            seenInThisScheme.add("age");
          }
          if (compiled.hard_filters.min_income !== undefined || compiled.hard_filters.max_income !== undefined) {
            seenInThisScheme.add("annual_family_income");
          }
          if (compiled.hard_filters.allowed_genders !== undefined) {
            seenInThisScheme.add("gender");
          }
          if (compiled.hard_filters.district_ids !== undefined) {
            seenInThisScheme.add("district");
          }
        }

        for (const attr of seenInThisScheme) {
          counts.set(attr, (counts.get(attr) || 0) + 1);
        }
      }
    } catch {
      // Ignore if schemes table is empty during initial migration
    }
    return counts;
  }

  /**
   * Seeds profile sections from seed file, validates, and assigns unmapped attributes to "Other".
   */
  static async seedProfileSections(seedPath?: string): Promise<{
    sectionsCount: number;
    fieldsCount: number;
    unmappedAttributes: string[];
    warnings: string[];
  }> {
    const filePath = seedPath || path.resolve(process.cwd(), "src/seed/profile-sections.json");
    if (!fs.existsSync(filePath)) {
      throw new Error(`Profile sections seed file not found at: ${filePath}`);
    }

    const rawContent = fs.readFileSync(filePath, "utf-8");
    const parsedJson = JSON.parse(rawContent);
    const validatedSections = ProfileSectionsFileSchema.parse(parsedJson);

    const schemeCounts = await this.computeAttributeSchemeCounts();

    // Collect all assigned attribute keys
    const assignedKeys = new Set<string>();
    for (const sec of validatedSections) {
      for (const f of sec.fields) {
        assignedKeys.add(f.attribute_key);
      }
    }

    // Identify attributes in DB not assigned to any section
    const dbAttrs = await db.select({ key: schema.attributes.key }).from(schema.attributes);
    const unmappedAttributes: string[] = [];
    for (const a of dbAttrs) {
      if (!assignedKeys.has(a.key)) {
        unmappedAttributes.push(a.key);
      }
    }

    const warnings: string[] = [];
    if (unmappedAttributes.length > 0) {
      warnings.push(
        `${unmappedAttributes.length} attribute(s) missing from profile sections; automatically assigned to section 'other': ${unmappedAttributes.join(", ")}`
      );
    }

    // Clear existing section fields and sections
    await db.delete(schema.profileSectionFields);
    await db.delete(schema.profileSections);

    let totalFields = 0;

    for (const sec of validatedSections) {
      await db.insert(schema.profileSections).values({
        id: sec.id,
        order: sec.order,
        scope: sec.scope,
        title: sec.title,
        description: sec.description || null,
        skippable: sec.skippable,
      });

      for (const f of sec.fields) {
        const requiredCount = schemeCounts.get(f.attribute_key) || 0;
        await db.insert(schema.profileSectionFields).values({
          section_id: sec.id,
          attribute_key: f.attribute_key,
          order: f.order,
          required_for_count: requiredCount,
          optional: f.optional,
        });
        totalFields++;
      }
    }

    // Auto-create "other" section for unmapped attributes
    if (unmappedAttributes.length > 0) {
      const otherSectionId = "other";
      await db.insert(schema.profileSections).values({
        id: otherSectionId,
        order: 999,
        scope: "household",
        title: {
          en: "Other Details",
          hi: "अन्य विवरण",
          mr: "इतर तपशील",
        },
        description: {
          en: "Additional miscellaneous eligibility criteria",
          hi: "अतिरिक्त विविध पात्रता मानदंड",
          mr: "अतिरिक्त विविध पात्रता निकष",
        },
        skippable: true,
      });

      let otherOrder = 1;
      for (const unmappedKey of unmappedAttributes) {
        const requiredCount = schemeCounts.get(unmappedKey) || 0;
        await db.insert(schema.profileSectionFields).values({
          section_id: otherSectionId,
          attribute_key: unmappedKey,
          order: otherOrder++,
          required_for_count: requiredCount,
          optional: true,
        });
        totalFields++;
      }
    }

    return {
      sectionsCount: validatedSections.length + (unmappedAttributes.length > 0 ? 1 : 0),
      fieldsCount: totalFields,
      unmappedAttributes,
      warnings,
    };
  }

  /**
   * Retrieves profile sections structure localized with question and help text.
   */
  static async getSections(lang: "en" | "hi" | "mr" = "en") {
    const sections = await db.select().from(schema.profileSections);
    const fields = await db.select().from(schema.profileSectionFields);
    const attrs = await db.select().from(schema.attributes);

    const attrMap = new Map(attrs.map((a) => [a.key, a]));

    const fieldsBySection = new Map<string, typeof fields>();
    for (const f of fields) {
      const list = fieldsBySection.get(f.section_id) || [];
      list.push(f);
      fieldsBySection.set(f.section_id, list);
    }

    sections.sort((a, b) => a.order - b.order);

    return {
      sections: sections.map((sec) => {
        const titleObj = sec.title as { en: string; hi?: string; mr?: string };
        const descObj = sec.description as { en?: string; hi?: string; mr?: string } | null;

        const secFields = fieldsBySection.get(sec.id) || [];
        secFields.sort((a, b) => a.order - b.order);

        return {
          id: sec.id,
          order: sec.order,
          scope: sec.scope,
          title: titleObj[lang] || titleObj.en,
          description: descObj ? descObj[lang] || descObj.en : null,
          skippable: sec.skippable,
          fields: secFields.map((f) => {
            const attrMeta = attrMap.get(f.attribute_key);
            const qText = attrMeta?.question_text as { en: string; hi?: string; mr?: string } | undefined;
            const hText = attrMeta?.help_text as { en?: string; hi?: string; mr?: string } | undefined;

            return {
              attribute_key: f.attribute_key,
              order: f.order,
              optional: f.optional,
              required_for_count: f.required_for_count,
              used_by_scheme_count: f.required_for_count,
              label: qText ? qText[lang] || qText.en : f.attribute_key,
              help_text: hText ? hText[lang] || hText.en : null,
              value_type: attrMeta?.value_type || "string",
              enum_values: attrMeta?.enum_values || null,
              unit: attrMeta?.unit || null,
            };
          }),
        };
      }),
    };
  }

  /**
   * Retrieves a household's profile completion state, answered/unanswered fields, and provenance.
   */
  static async getHouseholdProfile(householdId: string, lang: "en" | "hi" | "mr" = "en") {
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

    const storedAnswers = await db
      .select()
      .from(schema.memberAnswers)
      .where(eq(schema.memberAnswers.household_id, householdId));

    const sectionsData = await this.getSections(lang);

    // Build map of answers: key -> answerRecord
    const answerMap = new Map<string, typeof storedAnswers[0]>();
    const confirmedValues: Record<string, unknown> = {};

    for (const ans of storedAnswers) {
      const mapKey = ans.member_id ? `${ans.member_id}:${ans.attribute_key}` : ans.attribute_key;
      answerMap.set(mapKey, ans);
      // For general household lookups, also register by attribute_key
      if (!answerMap.has(ans.attribute_key)) {
        answerMap.set(ans.attribute_key, ans);
      }
      if (ans.status === "confirmed" && ans.value !== null) {
        confirmedValues[ans.attribute_key] = ans.value;
      }
    }

    // Also populate default fields from household table if not in member_answers
    if (hh[0].district_id && !confirmedValues.district) confirmedValues.district = hh[0].district_id;
    if (hh[0].taluka && !confirmedValues.taluka) confirmedValues.taluka = hh[0].taluka;
    if (hh[0].state && !confirmedValues.residence_state) confirmedValues.residence_state = hh[0].state;

    // Check consistency warnings
    const warnings = validateConsistency(confirmedValues, {
      familySize: typeof confirmedValues.family_size === "number" ? confirmedValues.family_size : members.length,
      memberCount: members.length,
    });

    let totalFieldsCount = 0;
    let answeredFieldsCount = 0;
    let lastActiveSectionId: string | null = null;

    const sectionsWithProgress = sectionsData.sections.map((sec) => {
      let secAnsweredCount = 0;
      const secTotalFields = sec.fields.length;

      const fieldsWithStatus = sec.fields.map((f) => {
        const answer = answerMap.get(f.attribute_key);
        const hasValue = answer !== undefined && answer.value !== null;
        if (hasValue) {
          secAnsweredCount++;
        }

        return {
          ...f,
          answered: hasValue,
          value: answer ? answer.value : null,
          provenance: answer
            ? {
                source: answer.source,
                status: answer.status,
                updated_at: answer.updated_at,
                updated_by_role: answer.updated_by_role,
              }
            : null,
        };
      });

      totalFieldsCount += secTotalFields;
      answeredFieldsCount += secAnsweredCount;

      const secCompletion = secTotalFields > 0 ? Math.round((secAnsweredCount / secTotalFields) * 100) : 100;
      if (lastActiveSectionId === null && secCompletion < 100) {
        lastActiveSectionId = sec.id;
      }

      return {
        id: sec.id,
        order: sec.order,
        scope: sec.scope,
        title: sec.title,
        description: sec.description,
        skippable: sec.skippable,
        completion_percentage: secCompletion,
        total_fields: secTotalFields,
        answered_count: secAnsweredCount,
        unanswered_count: secTotalFields - secAnsweredCount,
        fields: fieldsWithStatus,
      };
    });

    const overallCompletion = totalFieldsCount > 0 ? Math.round((answeredFieldsCount / totalFieldsCount) * 100) : 0;

    return {
      household_id: householdId,
      completion_percentage: overallCompletion,
      last_active_section_id: lastActiveSectionId || sectionsData.sections[0]?.id || "personal",
      answered_fields_count: answeredFieldsCount,
      total_fields_count: totalFieldsCount,
      sections: sectionsWithProgress,
      warnings,
    };
  }
}
