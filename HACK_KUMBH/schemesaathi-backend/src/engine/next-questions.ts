import { Evaluator } from "./evaluator.js";
import { EvaluationContext, EvaluationSubject, SchemeCompiledRules } from "./types.js";

export interface QuestionAttributeMeta {
  key: string;
  scope: string;
  value_type: string;
  enum_values?: string[];
  unit?: string;
  question_text: { en: string; hi?: string; mr?: string };
  help_text?: { en?: string; hi?: string; mr?: string };
}

export interface NextQuestionItem {
  attribute_key: string;
  scope: string;
  value_type: string;
  enum_values?: string[];
  unit?: string;
  question: string;
  help_text?: string;
  question_translations: { en: string; hi?: string; mr?: string };
  schemes_affected: number;
  resolved_scheme_count: number;
  impact_score: number;
}

export class AdaptiveQuestionnaire {
  /**
   * Gate-Aware next-questions ranking:
   * 1. Evaluates only still-possible (UNKNOWN) schemes (ignores schemes already NOT_ELIGIBLE).
   * 2. Gate suppression: derived automatically from compiled rules. For each scheme, find the
   *    unresolved mandatory AND rules; only the first unresolved rule (the gate) counts until resolved.
   *    All subsequent rules behind an unanswered gate are suppressed for that scheme.
   * 3. Counts resolved_scheme_count: how many UNKNOWN schemes have this attribute as the sole remaining unknown.
   * 4. Weights household-wide attributes (scope === "household" from metadata registry) first.
   * 5. Returns 1 batch of at most 5 questions prioritizing attributes that resolve or eliminate the most schemes.
   */
  static getNextQuestions(
    subject: EvaluationSubject,
    context: EvaluationContext,
    schemes: SchemeCompiledRules[],
    attributeRegistry: Map<string, QuestionAttributeMeta>,
    limit = 5,
    lang: "en" | "hi" | "mr" = "en"
  ): NextQuestionItem[] {
    const attributeCounts = new Map<string, { count: number; decisiveCount: number }>();

    for (const scheme of schemes) {
      const result = Evaluator.evaluate(subject, context, scheme);
      if (result.status !== "UNKNOWN") {
        continue;
      }

      // Mandatory AND rules derivation:
      // Filter mandatory AND rules in declaration order
      const mandatoryAndRules = (scheme.rules || []).filter(
        (r) => r.mandatory && (r.logical_group === "AND" || !r.logical_group) && !r.advisory_only
      );

      // Find the first unresolved mandatory AND rule for this scheme
      let gateRuleIndex = -1;
      for (let i = 0; i < mandatoryAndRules.length; i++) {
        const r = mandatoryAndRules[i]!;
        const val = Evaluator.resolveAttributeValue(r.attribute, subject, context);
        if (val === undefined || val === null) {
          gateRuleIndex = i;
          break;
        }
      }

      let candidateAttributes: string[] = [];

      if (gateRuleIndex !== -1) {
        // The first unresolved mandatory AND rule is the active gate for this scheme!
        // All subsequent rules for this scheme are behind the gate and suppressed.
        const gateRule = mandatoryAndRules[gateRuleIndex]!;
        candidateAttributes = [gateRule.attribute];
      } else {
        // All mandatory AND rules are satisfied!
        // Unresolved attributes from other rules (e.g. OR pathways) can be asked.
        candidateAttributes = result.unknown_attributes.filter((attr) => {
          if (attr === "subscheme") return false;
          const val = Evaluator.resolveAttributeValue(attr, subject, context);
          return val === undefined || val === null;
        });
      }

      // If answering this candidate attribute resolves this scheme (only 1 remaining unknown)
      const isDecisive = candidateAttributes.length === 1;

      for (const attr of candidateAttributes) {
        const current = attributeCounts.get(attr) || { count: 0, decisiveCount: 0 };
        current.count += 1;
        if (isDecisive) current.decisiveCount += 1;
        attributeCounts.set(attr, current);
      }
    }

    // Sort by information gain:
    // impact_score = (resolved_scheme_count * 5 + schemes_affected) * household_weight
    // Household weighting is derived purely from attributeRegistry metadata (meta?.scope === "household")
    const sorted = Array.from(attributeCounts.entries())
      .map(([attr, stats]) => {
        const meta = attributeRegistry.get(attr);
        const isHousehold = meta?.scope === "household";
        const weight = isHousehold ? 2.5 : 1.0;
        const impactScore = (stats.decisiveCount * 5 + stats.count) * weight;
        return { attribute: attr, stats, impactScore, decisiveCount: stats.decisiveCount };
      })
      .sort((a, b) => {
        if (b.impactScore !== a.impactScore) {
          return b.impactScore - a.impactScore;
        }
        if (b.decisiveCount !== a.decisiveCount) {
          return b.decisiveCount - a.decisiveCount;
        }
        if (b.stats.count !== a.stats.count) {
          return b.stats.count - a.stats.count;
        }
        return a.attribute.localeCompare(b.attribute);
      });

    const questions: NextQuestionItem[] = [];

    for (const item of sorted.slice(0, limit)) {
      const meta = attributeRegistry.get(item.attribute);
      const enQuestion = meta?.question_text.en || `What is your ${item.attribute.replace(/_/g, " ")}?`;
      const hiQuestion = meta?.question_text.hi || meta?.question_text.en || enQuestion;
      const mrQuestion = meta?.question_text.mr || meta?.question_text.en || enQuestion;

      let servedQuestion = enQuestion;
      if (lang === "mr" && mrQuestion) servedQuestion = mrQuestion;
      else if (lang === "hi" && hiQuestion) servedQuestion = hiQuestion;

      let servedHelp = meta?.help_text?.en;
      if (lang === "mr" && meta?.help_text?.mr) servedHelp = meta.help_text.mr;
      else if (lang === "hi" && meta?.help_text?.hi) servedHelp = meta.help_text.hi;

      questions.push({
        attribute_key: item.attribute,
        scope: meta?.scope || "member",
        value_type: meta?.value_type || "boolean",
        enum_values: meta?.enum_values,
        unit: meta?.unit,
        question: servedQuestion,
        help_text: servedHelp,
        question_translations: {
          en: enQuestion,
          hi: hiQuestion,
          mr: mrQuestion,
        },
        schemes_affected: item.stats.count,
        resolved_scheme_count: item.decisiveCount,
        impact_score: item.impactScore,
      });
    }

    return questions;
  }
}
