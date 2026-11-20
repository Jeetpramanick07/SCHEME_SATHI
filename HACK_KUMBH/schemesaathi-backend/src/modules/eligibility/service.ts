import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { Evaluator } from "../../engine/evaluator.js";
import { AdaptiveQuestionnaire, QuestionAttributeMeta } from "../../engine/next-questions.js";
import {
  CombinationWarning,
  EvaluationContext,
  EvaluationSubject,
  MemberSchemeResult,
  SchemeCompiledRules,
} from "../../engine/types.js";
import { MESSAGE_TEMPLATES } from "../../engine/templates.js";
import { rulesCache } from "../../services/cache.js";
import { EvaluateRequestSchema, NextQuestionsRequestSchema } from "./schema.js";
import { z } from "zod";

export class EligibilityService {
  /**
   * Ensures compiled rules are cached in memory for sub-millisecond evaluation.
   */
  static async loadCompiledRules(includeTest = false): Promise<SchemeCompiledRules[]> {
    if (rulesCache.isLoaded()) {
      return rulesCache.getAll();
    }

    const whereClause = includeTest
      ? eq(schema.schemes.status, "ACTIVE")
      : and(eq(schema.schemes.status, "ACTIVE"), eq(schema.schemes.is_test, false));

    const rows = await db
      .select({
        scheme_id: schema.schemes.scheme_id,
        compiled_rules: schema.schemes.compiled_rules,
        version: schema.schemes.version,
      })
      .from(schema.schemes)
      .where(whereClause);

    const compiledList: SchemeCompiledRules[] = [];
    for (const r of rows) {
      if (r.compiled_rules) {
        compiledList.push(r.compiled_rules as unknown as SchemeCompiledRules);
      }
    }

    const version = `v_${Date.now()}`;
    rulesCache.setAll(compiledList, version);
    return compiledList;
  }

  /**
   * Loads attribute registry metadata for adaptive questionnaire.
   */
  static async loadAttributeRegistry(): Promise<Map<string, QuestionAttributeMeta>> {
    const rows = await db.select().from(schema.attributes);
    const registry = new Map<string, QuestionAttributeMeta>();

    for (const r of rows) {
      registry.set(r.key, {
        key: r.key,
        scope: r.scope,
        value_type: r.value_type,
        enum_values: (r.enum_values as string[]) || undefined,
        unit: r.unit || undefined,
        question_text: r.question_text as { en: string; hi?: string; mr?: string },
        help_text: (r.help_text as { en?: string; hi?: string; mr?: string }) || undefined,
      });
    }

    return registry;
  }

  /**
   * Stateless evaluation for household members.
   */
  static async evaluate(payload: z.input<typeof EvaluateRequestSchema>) {
    const compiledSchemes = await this.loadCompiledRules();
    const lang = payload.lang || "en";

    // Combine global answers with household answers
    const householdAnswers: Record<string, unknown> = {
      ...(payload.answers || {}),
      ...(payload.household?.answers || {}),
    };
    if (payload.household?.bpl_card_holder !== undefined) {
      if (householdAnswers["in_bpl_list"] === undefined) {
        householdAnswers["in_bpl_list"] = payload.household.bpl_card_holder;
      }
      if (householdAnswers["belongs_to_bpl_household"] === undefined) {
        householdAnswers["belongs_to_bpl_household"] = payload.household.bpl_card_holder;
      }
    }

    const householdContext = {
      ...payload.household,
      answers: householdAnswers,
    };

    // Load data-driven attribute -> approved parent scheme mappings (no hardcoded scheme IDs)
    const attrRows = await db
      .select({
        key: schema.attributes.key,
        derived_from_approved_scheme: schema.attributes.derived_from_approved_scheme,
        question_text: schema.attributes.question_text,
      })
      .from(schema.attributes);

    const parentMappings: Record<string, string> = {};
    const attributeLabels: Record<string, { en: string; hi?: string; mr?: string }> = {};
    for (const r of attrRows) {
      if (r.derived_from_approved_scheme) {
        parentMappings[r.key] = r.derived_from_approved_scheme;
      }
      if (r.question_text) {
        const qt = r.question_text as { en?: string; hi?: string; mr?: string };
        attributeLabels[r.key] = {
          en: qt.en || r.key.replace(/_/g, " "),
          hi: qt.hi,
          mr: qt.mr,
        };
      }
    }

    // Load data-driven district mappings from DB
    const districtRows = await db
      .select({
        district_id: schema.districts.district_id,
        district_name: schema.districts.district_name,
      })
      .from(schema.districts);

    const districtMap: Record<string, string> = {};
    for (const d of districtRows) {
      districtMap[d.district_id] = d.district_name.toUpperCase();
    }

    const resultsByMember: Array<{
      member_id: string;
      eligible: MemberSchemeResult[];
      needs_few_answers: MemberSchemeResult[];
      unknown: MemberSchemeResult[];
      not_eligible: MemberSchemeResult[];
      not_eligible_by_reason: Record<string, string[]>;
      combination_warnings: CombinationWarning[];
      all_schemes_count: number;
    }> = [];

    // Pre-fetch scheme names and benefit metadata for clean output
    const allSchemes = await db.select({
      scheme_id: schema.schemes.scheme_id,
      official_name: schema.schemes.official_name,
      translated_names: schema.schemes.translated_names,
      translation_status: schema.schemes.translation_status,
      benefits: schema.schemes.benefits,
      non_stackable_with: schema.schemes.non_stackable_with,
      benefit_cap: schema.schemes.benefit_cap,
    }).from(schema.schemes);

    const namesMap = new Map<string, { official: string; localized: string; fallback: boolean }>();
    const benefitsMap = new Map<string, { benefit_type?: string; amount?: number | string; currency?: string }>();
    const compiledMap = new Map<string, SchemeCompiledRules>();
    for (const cs of compiledSchemes) compiledMap.set(cs.scheme_id, cs);

    for (const s of allSchemes) {
      const trans = s.translated_names as { en: string; hi?: string; mr?: string };
      const statusMap = s.translation_status as Record<string, { en: string; hi: string; mr: string }> | null;
      let localized = s.official_name;
      let fallback = false;

      if (lang === "mr") {
        if (trans?.mr && statusMap?.translated_names?.mr !== "placeholder") {
          localized = trans.mr;
        } else {
          fallback = true;
        }
      } else if (lang === "hi") {
        if (trans?.hi && statusMap?.translated_names?.hi !== "placeholder") {
          localized = trans.hi;
        } else {
          fallback = true;
        }
      }

      namesMap.set(s.scheme_id, {
        official: s.official_name,
        localized,
        fallback,
      });

      const b = s.benefits as { benefit_type?: string; amount?: number | string; currency?: string } | null;
      benefitsMap.set(s.scheme_id, b || {});
    }

    const includeAll = Boolean(payload.include_all);

    for (const member of payload.members) {
      const memberId = member.member_id || `mem_${Math.random().toString(36).substring(2, 7)}`;
      const memberSubject: EvaluationSubject = {
        member_id: memberId,
        relation_to_head: member.relation_to_head,
        age: member.age,
        gender: member.gender,
        occupation: member.occupation,
        caste_category: member.caste_category || member.social_category,
        marital_status: member.marital_status,
        answers: {
          ...householdAnswers,
          ...(member.answers || {}),
        },
      };

      const context: EvaluationContext = {
        household: householdContext,
        members: [memberSubject],
        approved_parent_benefits: payload.approved_parent_benefits,
        attribute_parent_mappings: parentMappings,
        district_name_by_id: districtMap,
        attribute_labels: attributeLabels,
        language: lang,
      };

      const eligible: MemberSchemeResult[] = [];
      const likely: MemberSchemeResult[] = [];
      const unknown: MemberSchemeResult[] = [];
      const notEligible: MemberSchemeResult[] = [];
      const notEligibleByReason: Record<string, string[]> = {};

      for (const scheme of compiledSchemes) {
        const res = Evaluator.evaluate(memberSubject, context, scheme);
        const nameInfo = namesMap.get(scheme.scheme_id);
        res.official_name = nameInfo ? nameInfo.localized : scheme.scheme_id;

        if (res.status === "ELIGIBLE") {
          eligible.push(res);
        } else if (res.status === "UNKNOWN") {
          // needs_few_answers = UNKNOWN with few missing attributes (<= 2)
          if (res.unknown_attributes.length <= 2) {
            likely.push(res);
          } else {
            unknown.push(res);
          }
        } else {
          // NOT_ELIGIBLE
          // Hide schemes failing ONLY on geography/area from default results
          if (!includeAll && res.failed_on_geography_only) {
            continue;
          }

          notEligible.push(res);

          // Group by primary localized reason
          const reasonsList = res.reasons[lang] || res.reasons.en;
          for (const r of reasonsList) {
            if (!notEligibleByReason[r]) notEligibleByReason[r] = [];
            notEligibleByReason[r].push(res.official_name || res.scheme_id);
          }
        }
      }

      // Sort eligible schemes: non-seasonal first, then by scheme_id
      eligible.sort((a, b) => {
        if (!a.seasonal && b.seasonal) return -1;
        if (a.seasonal && !b.seasonal) return 1;
        return a.scheme_id.localeCompare(b.scheme_id);
      });

      // Sort needs_few_answers & unknown schemes: fewest unknowns first
      likely.sort((a, b) => a.unknown_attributes.length - b.unknown_attributes.length);
      unknown.sort((a, b) => a.unknown_attributes.length - b.unknown_attributes.length);

      const combinationWarnings = this.checkBenefitCombinations(eligible, compiledMap, benefitsMap, lang);

      resultsByMember.push({
        member_id: memberId,
        eligible,
        needs_few_answers: likely,
        unknown,
        not_eligible: notEligible,
        not_eligible_by_reason: notEligibleByReason,
        combination_warnings: combinationWarnings,
        all_schemes_count: compiledSchemes.length,
      });
    }

    const schemesLackingStackingData = compiledSchemes
      .filter((s) => !s.non_stackable_with && !s.benefit_cap)
      .map((s) => s.scheme_id);

    return {
      evaluated_at: new Date().toISOString(),
      language: lang,
      results: resultsByMember,
      schemes_lacking_stacking_data: schemesLackingStackingData,
    };
  }

  private static checkBenefitCombinations(
    eligibleSchemes: MemberSchemeResult[],
    compiledMap: Map<string, SchemeCompiledRules>,
    benefitsMap: Map<string, { benefit_type?: string; amount?: number | string; currency?: string }>,
    _lang: "en" | "hi" | "mr"
  ): CombinationWarning[] {
    const warnings: CombinationWarning[] = [];
    const eligibleIds = new Set(eligibleSchemes.map((s) => s.scheme_id));

    // 1. Explicit non_stackable_with checks
    for (const es of eligibleSchemes) {
      const compiled = compiledMap.get(es.scheme_id);
      if (compiled?.non_stackable_with && compiled.non_stackable_with.length > 0) {
        const conflicts = compiled.non_stackable_with.filter((id) => eligibleIds.has(id));
        if (conflicts.length > 0) {
          warnings.push({
            type: "NON_STACKABLE",
            scheme_ids: [es.scheme_id, ...conflicts],
            message: {
              en: `Scheme ${es.official_name || es.scheme_id} cannot be availed concurrently with: ${conflicts.join(", ")}`,
              hi: `योजना ${es.official_name || es.scheme_id} को इनके साथ समवर्ती रूप से नहीं लिया जा सकता: ${conflicts.join(", ")}`,
              mr: `योजना ${es.official_name || es.scheme_id} खालील योजनांसोबत एकाच वेळी घेता येत नाही: ${conflicts.join(", ")}`,
            },
          });
        }
      }
    }

    // 2. Benefit Cap checks
    for (const es of eligibleSchemes) {
      const compiled = compiledMap.get(es.scheme_id);
      if (compiled?.benefit_cap?.max_amount) {
        const cap = compiled.benefit_cap.max_amount;
        let totalCash = 0;
        for (const other of eligibleSchemes) {
          const b = benefitsMap.get(other.scheme_id);
          if (b && typeof b.amount === "number") {
            totalCash += b.amount;
          }
        }
        if (totalCash > cap) {
          warnings.push({
            type: "BENEFIT_CAP_EXCEEDED",
            scheme_ids: [es.scheme_id],
            message: {
              en: `Combined benefit exceeds maximum allowable cap of ${compiled.benefit_cap.currency || "INR"} ${cap}`,
              hi: `संयुक्त लाभ अधिकतम स्वीकार्य सीमा ${compiled.benefit_cap.currency || "INR"} ${cap} से अधिक है`,
              mr: `एकूण लाभ जास्तीत जास्त मर्यादेपेक्षा (${compiled.benefit_cap.currency || "INR"} ${cap}) जास्त आहे`,
            },
          });
        }
      }
    }

    // 3. Concurrency warning across multiple cash/financial assistance schemes
    const cashSchemes = eligibleSchemes.filter((es) => {
      const b = benefitsMap.get(es.scheme_id);
      const bt = (b?.benefit_type || compiledMap.get(es.scheme_id)?.benefit_type || "").toUpperCase();
      return bt === "FINANCIAL" || bt === "CASH_TRANSFER" || bt === "FINANCIAL_ASSISTANCE";
    });

    if (cashSchemes.length > 1) {
      const namesInLang = cashSchemes.map((s) => s.official_name || s.scheme_id).join(", ");
      const tpl = MESSAGE_TEMPLATES.MULTIPLE_CASH_BENEFITS;
      warnings.push({
        type: "POTENTIAL_CASH_OVERLAP",
        scheme_ids: cashSchemes.map((s) => s.scheme_id),
        message: {
          en: `${tpl.en} (${namesInLang})`,
          hi: `${tpl.hi} (${namesInLang})`,
          mr: `${tpl.mr} (${namesInLang})`,
        },
      });
    }

    return warnings;
  }

  /**
   * Adaptive questionnaire next-questions ranking.
   */
  static async getNextQuestions(payload: z.input<typeof NextQuestionsRequestSchema>) {
    const compiledSchemes = await this.loadCompiledRules();
    const registry = await this.loadAttributeRegistry();

    const subject: EvaluationSubject = {
      member_id: payload.subject?.member_id,
      relation_to_head: payload.subject?.relation_to_head,
      age: payload.subject?.age,
      gender: payload.subject?.gender,
      occupation: payload.subject?.occupation,
      caste_category: payload.subject?.caste_category,
      marital_status: payload.subject?.marital_status,
      answers: {
        ...(payload.answers || {}),
        ...(payload.subject?.answers || {}),
      },
    };

    const context: EvaluationContext = {
      household: payload.household,
      members: [subject],
      language: payload.lang,
    };

    return AdaptiveQuestionnaire.getNextQuestions(
      subject,
      context,
      compiledSchemes,
      registry,
      payload.limit || 5,
      payload.lang || "en"
    );
  }
}
