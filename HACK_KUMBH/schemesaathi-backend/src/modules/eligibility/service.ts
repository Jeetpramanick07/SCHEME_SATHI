import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { Evaluator } from "../../engine/evaluator.js";
import { AdaptiveQuestionnaire, QuestionAttributeMeta } from "../../engine/next-questions.js";
import {
  EvaluationContext,
  EvaluationSubject,
  MemberSchemeResult,
  SchemeCompiledRules,
} from "../../engine/types.js";
import { rulesCache } from "../../services/cache.js";
import { EvaluateRequestSchema, NextQuestionsRequestSchema } from "./schema.js";
import { z } from "zod";

import { config } from "../../config.js";

export function isCuratedOrVerified(scheme: {
  source?: string | null;
  verified?: boolean | null;
  confidence_level?: string | null;
  last_verified?: string | null;
}): boolean {
  if (scheme.source === "curated") return true;
  if (scheme.verified === true) return true;
  if (
    scheme.confidence_level?.toUpperCase() === "HIGH" &&
    scheme.last_verified &&
    scheme.last_verified !== "UNVERIFIED"
  ) {
    return true;
  }
  return false;
}

export function calculateExploreRelevanceScore(
  scheme: SchemeCompiledRules,
  subject: EvaluationSubject,
  context: EvaluationContext,
  rawName?: string
): number {
  let score = 0;

  // 1. Gender hard-filter specificity
  const genders = scheme.hard_filters?.allowed_genders;
  if (genders && genders.length > 0) {
    const subGender = subject.gender?.toUpperCase();
    if (subGender && genders.map((g) => g.toUpperCase()).includes(subGender)) {
      if (!genders.includes("ALL")) {
        score += 20;
      }
    }
  }

  // 2. Age hard-filter specificity
  const minAge = scheme.hard_filters?.min_age;
  const maxAge = scheme.hard_filters?.max_age;
  if (subject.age !== undefined) {
    if (minAge !== undefined && maxAge !== undefined && subject.age >= minAge && subject.age <= maxAge) {
      score += 20;
    } else if (
      (minAge !== undefined && subject.age >= minAge) ||
      (maxAge !== undefined && subject.age <= maxAge)
    ) {
      score += 15;
    }
  }

  // 3. Category / Social category / Marital / Target match
  const categories = (scheme.beneficiary_categories || []).map((c) => c.toUpperCase());
  const nameUpper = (rawName || scheme.scheme_id).toUpperCase();
  const subCategory = subject.caste_category?.toUpperCase();
  const subMarital = subject.marital_status?.toUpperCase();

  if (subCategory && (categories.some((c) => c.includes(subCategory)) || nameUpper.includes(subCategory))) {
    score += 15;
  }
  if (subMarital === "WIDOW" || subMarital === "WIDOWER") {
    if (
      categories.some((c) => c.includes("WIDOW") || c.includes("WOMEN") || c.includes("DESTITUTE")) ||
      nameUpper.includes("WIDOW") ||
      nameUpper.includes("NIRADHAR") ||
      nameUpper.includes("WOMEN")
    ) {
      score += 20;
    }
  }
  if (subject.occupation) {
    const occUpper = subject.occupation.toUpperCase();
    if (categories.some((c) => c.includes(occUpper)) || nameUpper.includes(occUpper)) {
      score += 15;
    }
  }

  // 4. District / Area type match
  const dists = scheme.hard_filters?.district_ids;
  if (dists && dists.length > 0 && context.household?.district_id) {
    if (dists.includes(context.household.district_id)) {
      score += 10;
    }
  }
  if (scheme.hard_filters?.area_type && scheme.hard_filters.area_type !== "ALL" && context.household?.area_type) {
    if (scheme.hard_filters.area_type.toUpperCase() === context.household.area_type.toUpperCase()) {
      score += 5;
    }
  }

  return score;
}

export class EligibilityService {
  /**
   * Ensures compiled rules are cached in memory for sub-millisecond evaluation.
   */
  static async loadCompiledRules(includeTest = false): Promise<SchemeCompiledRules[]> {
    if (!includeTest && rulesCache.isLoaded()) {
      return rulesCache.getAll().filter((s) => !s.is_test);
    }
    if (includeTest && rulesCache.isLoaded()) {
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
        is_test: schema.schemes.is_test,
        source: schema.schemes.source,
        verified: schema.schemes.verified,
        beneficiary_categories: schema.schemes.beneficiary_categories,
      })
      .from(schema.schemes)
      .where(whereClause);

    const compiledList: SchemeCompiledRules[] = [];
    for (const r of rows) {
      if (r.compiled_rules) {
        const c = r.compiled_rules as unknown as SchemeCompiledRules;
        c.is_test = r.is_test;
        c.source = r.source || "curated";
        c.verified = Boolean(r.verified);
        c.beneficiary_categories = r.beneficiary_categories || [];
        compiledList.push(c);
      }
    }

    const version = `v_${Date.now()}`;
    rulesCache.setAll(compiledList, version);
    return compiledList.filter((s) => includeTest || !s.is_test);
  }

  /**
   * Loads attribute registry metadata for adaptive questionnaire.
   */
  static async loadAttributeRegistry(): Promise<Map<string, QuestionAttributeMeta>> {
    const cached = rulesCache.getAttributeRegistry<Map<string, QuestionAttributeMeta>>();
    if (cached) return cached;

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

    rulesCache.setAttributeRegistry(registry);
    return registry;
  }

  static async loadParentMappings(): Promise<Record<string, string>> {
    const cached = rulesCache.getParentMappings();
    if (cached) return cached;

    const attrRows = await db
      .select({
        key: schema.attributes.key,
        derived_from_approved_scheme: schema.attributes.derived_from_approved_scheme,
      })
      .from(schema.attributes);

    const parentMappings: Record<string, string> = {};
    for (const r of attrRows) {
      if (r.derived_from_approved_scheme) {
        parentMappings[r.key] = r.derived_from_approved_scheme;
      }
    }
    rulesCache.setParentMappings(parentMappings);
    return parentMappings;
  }

  static async loadNamesMap(): Promise<Map<string, { official_name: string; translated_names: unknown; translation_status: unknown; confidence_level?: string | null; last_verified?: string | null; source?: string | null; verified?: boolean | null; raw?: unknown }>> {
    const cached = rulesCache.getNamesMap();
    if (cached) return cached;

    const allSchemes = await db.select({
      scheme_id: schema.schemes.scheme_id,
      official_name: schema.schemes.official_name,
      translated_names: schema.schemes.translated_names,
      translation_status: schema.schemes.translation_status,
      confidence_level: schema.schemes.confidence_level,
      last_verified: schema.schemes.last_verified,
      source: schema.schemes.source,
      verified: schema.schemes.verified,
      raw: schema.schemes.raw,
    }).from(schema.schemes).where(eq(schema.schemes.is_test, false));

    const map = new Map<string, { official_name: string; translated_names: unknown; translation_status: unknown; confidence_level?: string | null; last_verified?: string | null; source?: string | null; verified?: boolean | null; raw?: unknown }>();
    for (const s of allSchemes) {
      map.set(s.scheme_id, s);
    }
    rulesCache.setNamesMap(map);
    return map;
  }

  /**
   * Stateless evaluation for household members.
   */
  static async evaluate(payload: z.input<typeof EvaluateRequestSchema>) {
    const compiledSchemes = await this.loadCompiledRules();
    const lang = payload.lang || "en";

    // Combine global answers with household answers
    const householdAnswers = {
      ...(payload.answers || {}),
      ...(payload.household?.answers || {}),
    };

    const householdContext = {
      ...payload.household,
      answers: householdAnswers,
    };

    // Load data-driven attribute -> approved parent scheme mappings (no hardcoded scheme IDs)
    const parentMappings = await this.loadParentMappings();

    const resultsByMember: Array<{
      member_id: string;
      eligible: MemberSchemeResult[];
      likely: MemberSchemeResult[];
      unknown: MemberSchemeResult[];
      explore?: MemberSchemeResult[];
      not_eligible: MemberSchemeResult[];
      tiers?: {
        can_apply: MemberSchemeResult[];
        likely_confirm: MemberSchemeResult[];
        not_eligible: MemberSchemeResult[];
        explore?: MemberSchemeResult[];
      };
      not_eligible_by_reason: Record<string, string[]>;
      all_schemes_count: number;
    }> = [];

    // Pre-fetch scheme names for clean output
    const rawNamesMap = await this.loadNamesMap();
    const registry = await this.loadAttributeRegistry();

    const namesMap = new Map<
      string,
      {
        official: string;
        localized: string;
        fallback: boolean;
        confidence_badge: "high" | "medium" | "needs_confirmation";
        confidence_level?: string | null;
        source?: string | null;
        verified?: boolean | null;
        last_verified: string | null;
        bring_documents: Array<{
          document_id: string;
          name: string;
          mandatory: boolean;
          alternatives: string[];
        }>;
      }
    >();

    for (const [schemeId, s] of rawNamesMap.entries()) {
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

      const conf = String(s.confidence_level || "").toUpperCase();
      const confidence_badge = conf === "HIGH" ? "high" : conf === "MEDIUM" ? "medium" : "needs_confirmation";

      const rawObj = (s.raw as Record<string, unknown>) || {};
      const reqDocs = Array.isArray(rawObj.documents_required)
        ? (rawObj.documents_required as Array<Record<string, unknown>>)
        : [];
      const bring_documents = reqDocs.map((d) => ({
        document_id: String(d?.document_id || ""),
        name: String(d?.document_id || "").replace(/_/g, " "),
        mandatory: d?.mandatory !== false,
        alternatives: Array.isArray(d?.alternative_documents) ? (d.alternative_documents as string[]) : [],
      }));

      namesMap.set(schemeId, {
        official: s.official_name,
        localized,
        fallback,
        confidence_badge,
        confidence_level: s.confidence_level,
        source: s.source,
        verified: s.verified,
        last_verified: s.last_verified || null,
        bring_documents,
      });
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
        language: lang,
      };

      const includeExplore = Boolean(payload.include_explore);
      const eligible: MemberSchemeResult[] = [];
      const likely: MemberSchemeResult[] = [];
      const unknown: MemberSchemeResult[] = [];
      const explore: MemberSchemeResult[] = [];
      const notEligible: MemberSchemeResult[] = [];
      const notEligibleByReason: Record<string, string[]> = {};

      for (const scheme of compiledSchemes) {
        const res = Evaluator.evaluate(memberSubject, context, scheme);
        const nameInfo = namesMap.get(scheme.scheme_id);
        res.official_name = nameInfo ? nameInfo.localized : scheme.scheme_id;
        res.confidence_badge = nameInfo ? nameInfo.confidence_badge : "needs_confirmation";
        res.last_verified = nameInfo ? nameInfo.last_verified : null;

        res.disclaimer_keys = [
          "disclaimer.rules_subject_to_govt_change",
          "disclaimer.final_decision_with_authority",
        ];

        res.pre_trip_check = {
          bring_documents: nameInfo ? nameInfo.bring_documents : [],
          confirm_with_office: res.seasonal
            ? ["pre_trip.confirm_office", "Seasonal application window: verify if admissions are open"]
            : ["pre_trip.confirm_office"],
        };

        // What to confirm for UNKNOWN
        if (res.unknown_attributes.length > 0) {
          res.what_to_confirm = res.unknown_attributes.map((key) => {
            const meta = registry.get(key);
            const label = meta?.question_text ? (meta.question_text[lang] || meta.question_text.en) : key;
            return {
              attribute_key: key,
              label,
              why_it_matters: "Required to confirm eligibility criteria for this scheme",
            };
          });
        }

        const schemeSource = scheme.source || nameInfo?.source || "curated";
        const schemeVerified = scheme.verified !== undefined ? scheme.verified : Boolean(nameInfo?.verified);
        const isCurated = isCuratedOrVerified({
          source: schemeSource,
          verified: schemeVerified,
          confidence_level: nameInfo?.confidence_level,
          last_verified: nameInfo?.last_verified,
        });
        res.is_curated = schemeSource === "curated";
        res.is_verified = Boolean(schemeVerified);
        res.source = schemeSource;
        const mandatoryRulesEvaluated =
          (res.mandatory_rules_evaluated_count || 0) >= config.qualityGate.minMandatoryRulesEvaluated;

        if (res.status === "NOT_ELIGIBLE") {
          res.tier = "not_eligible";
          res.can_apply = false;
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
        } else if (!isCurated || (res.status === "ELIGIBLE" && !mandatoryRulesEvaluated)) {
          // Quality Gate: unverified/imported scheme OR 0 mandatory rules evaluated
          // Tier is explore (rules not verified, check with the office). Never labelled eligible!
          res.tier = "explore";
          res.status = "EXPLORE";
          res.can_apply = false;
          res.reasons = {
            en: ["Rules not verified, check with the office"],
            hi: ["नियम सत्यापित नहीं हैं, संबंधित कार्यालय से संपर्क करें"],
            mr: ["नियम पडताळलेले नाहीत, संबंधित कार्यालयाशी संपर्क साधा"],
          };
          res.relevance_score = calculateExploreRelevanceScore(
            scheme,
            memberSubject,
            context,
            nameInfo?.official || scheme.scheme_id
          );
          explore.push(res);
        } else {
          // Curated or verified scheme
          if (res.status === "ELIGIBLE") {
            res.tier = "can_apply";
            res.can_apply = true;
            eligible.push(res);
          } else {
            // UNKNOWN
            res.tier = "likely_confirm";
            res.can_apply = false;
            // LIKELY = UNKNOWN with few missing attributes (<= 2)
            if (res.unknown_attributes.length <= 2) {
              likely.push(res);
            } else {
              unknown.push(res);
            }
          }
        }
      }

      // Sort eligible schemes: non-seasonal first, then by scheme_id
      eligible.sort((a, b) => {
        if (!a.seasonal && b.seasonal) return -1;
        if (a.seasonal && !b.seasonal) return 1;
        return a.scheme_id.localeCompare(b.scheme_id);
      });

      // Sort likely & unknown schemes: fewest unknowns first
      likely.sort((a, b) => a.unknown_attributes.length - b.unknown_attributes.length);
      unknown.sort((a, b) => a.unknown_attributes.length - b.unknown_attributes.length);
      // Sort explore schemes: highest relevance score first, then by scheme_id
      explore.sort((a, b) => {
        const scoreDiff = (b.relevance_score || 0) - (a.relevance_score || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return a.scheme_id.localeCompare(b.scheme_id);
      });

      const cappedExplore = includeExplore ? explore.slice(0, config.qualityGate.exploreCap) : [];

      resultsByMember.push({
        member_id: memberId,
        eligible,
        likely,
        unknown,
        explore: cappedExplore,
        not_eligible: notEligible,
        tiers: {
          can_apply: eligible,
          likely_confirm: [...likely, ...unknown],
          not_eligible: notEligible,
          explore: cappedExplore,
        },
        not_eligible_by_reason: notEligibleByReason,
        all_schemes_count: compiledSchemes.length,
      });
    }

    return {
      evaluated_at: new Date().toISOString(),
      language: lang,
      results: resultsByMember,
    };
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
