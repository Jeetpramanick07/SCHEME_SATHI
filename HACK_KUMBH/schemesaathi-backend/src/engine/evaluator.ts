import {
  EvaluationContext,
  EvaluationStatus,
  EvaluationSubject,
  ExclusionHit,
  ExpressionNode,
  MemberSchemeResult,
  SchemeCompiledRules,
  UnmetCondition,
} from "./types.js";

type Trilean = "TRUE" | "FALSE" | "UNKNOWN";

export class Evaluator {
  /**
   * Pure evaluation function: evaluates a single subject against a scheme's compiled rules.
   * No DB access, zero side-effects.
   */
  static evaluate(
    subject: EvaluationSubject,
    context: EvaluationContext,
    scheme: SchemeCompiledRules
  ): MemberSchemeResult {
    // Check operational status
    const isActive = scheme.status.toUpperCase() === "ACTIVE";
    const accepting = scheme.accepting_applications.toUpperCase();
    const isAccepting = accepting === "YES" || accepting === "SEASONAL";
    const seasonal = accepting === "SEASONAL";

    if (!isActive || !isAccepting) {
      const statusLabels: Record<string, { en: string; hi: string; mr: string }> = {
        ACTIVE: { en: "active", hi: "सक्रिय", mr: "सुरू" },
        INACTIVE: { en: "inactive", hi: "निष्क्रिय", mr: "सध्या बंद" },
        DISCONTINUED: { en: "discontinued", hi: "बंद", mr: "बंद" },
        CLOSED: { en: "closed", hi: "बंद", mr: "बंद" },
      };

      const acceptingLabels: Record<string, { en: string; hi: string; mr: string }> = {
        YES: { en: "accepting applications", hi: "आवेदन स्वीकारे जा रहे हैं", mr: "अर्ज स्वीकारले जात आहेत" },
        NO: { en: "not accepting applications", hi: "आवेदन बंद हैं", mr: "अर्ज बंद आहेत" },
        SEASONAL: { en: "seasonally accepting applications", hi: "मौसमी आवेदन चालू हैं", mr: "हंगामी अर्ज सुरू आहेत" },
      };

      const st = statusLabels[scheme.status.toUpperCase()] || {
        en: scheme.status.toLowerCase(),
        hi: "निष्क्रिय",
        mr: "बंद",
      };
      const acc = acceptingLabels[scheme.accepting_applications.toUpperCase()] || {
        en: scheme.accepting_applications.toLowerCase(),
        hi: "आवेदन बंद हैं",
        mr: "अर्ज बंद आहेत",
      };

      return {
        scheme_id: scheme.scheme_id,
        status: "NOT_ELIGIBLE",
        seasonal,
        score: 0,
        unmet: [
          {
            attribute: "operational_status",
            operator: "EQUALS",
            expected: "ACTIVE / YES",
            actual: `${st.en} / ${acc.en}`,
            reason: {
              en: `Scheme is currently ${st.en} and ${acc.en}`,
              hi: `योजना वर्तमान में ${st.hi} है और नए ${acc.hi}`,
              mr: `योजना सध्या ${st.mr} आहे आणि नवीन ${acc.mr}`,
              review_status: "reviewed",
            },
          },
        ],
        unknown_attributes: [],
        exclusions_hit: [],
        advisories: [],
        reasons: {
          en: [`Scheme is currently ${st.en} and ${acc.en}`],
          hi: [`योजना वर्तमान में ${st.hi} है और नए ${acc.hi}`],
          mr: [`योजना सध्या ${st.mr} आहे आणि नवीन ${acc.mr}`],
        },
        review_status: "reviewed",
      };
    }

    const unmet: UnmetCondition[] = [];
    const unknownAttrs = new Set<string>();
    const exclusionsHit: ExclusionHit[] = [];
    const advisories: Array<{ rule_id: string; note: string }> = [];
    let matchedVariant: string | undefined;
    let matchedPathway: string | undefined;

    // 0. Hard filter evaluation (Age, Gender, Area Type, NMC Zone, District)
    if (subject.age !== undefined) {
      if (scheme.hard_filters.min_age !== undefined && subject.age < scheme.hard_filters.min_age) {
        unmet.push({
          attribute: "age",
          operator: "GREATER_THAN_OR_EQUAL",
          expected: scheme.hard_filters.min_age,
          actual: subject.age,
          reason: {
            en: `Age must be at least ${scheme.hard_filters.min_age} (current: ${subject.age})`,
            hi: `आयु कम से कम ${scheme.hard_filters.min_age} वर्ष होनी चाहिए (वर्तमान: ${subject.age})`,
            mr: `वय किमान ${scheme.hard_filters.min_age} वर्षे असणे आवश्यक आहे (सध्याचे: ${subject.age})`,
            review_status: "reviewed",
          },
        });
      }
      if (scheme.hard_filters.max_age !== undefined && subject.age > scheme.hard_filters.max_age) {
        unmet.push({
          attribute: "age",
          operator: "LESS_THAN_OR_EQUAL",
          expected: scheme.hard_filters.max_age,
          actual: subject.age,
          reason: {
            en: `Age must be at most ${scheme.hard_filters.max_age} (current: ${subject.age})`,
            hi: `आयु अधिकतम ${scheme.hard_filters.max_age} वर्ष होनी चाहिए (वर्तमान: ${subject.age})`,
            mr: `वय जास्तीत जास्त ${scheme.hard_filters.max_age} वर्षे असावे (सध्याचे: ${subject.age})`,
            review_status: "reviewed",
          },
        });
      }
    }

    if (subject.gender && scheme.hard_filters.allowed_genders && scheme.hard_filters.allowed_genders.length > 0) {
      const gen = subject.gender.toUpperCase();
      if (!scheme.hard_filters.allowed_genders.map((g) => g.toUpperCase()).includes(gen)) {
        unmet.push({
          attribute: "gender",
          operator: "IN",
          expected: scheme.hard_filters.allowed_genders,
          actual: subject.gender,
          reason: {
            en: `Restricted to gender: ${scheme.hard_filters.allowed_genders.join(", ")}`,
            hi: `केवल इस लिंग के लिए मान्य: ${scheme.hard_filters.allowed_genders.join(", ")}`,
            mr: `केवळ या लिंगासाठी: ${scheme.hard_filters.allowed_genders.join(", ")}`,
            review_status: "reviewed",
          },
        });
      }
    }

    // Area Type check (Urban / Rural)
    if (scheme.hard_filters.area_type === "URBAN") {
      const citizenAreaType = context.household?.area_type || (subject.answers["area_type"] as string | undefined);
      if (citizenAreaType === "RURAL") {
        unmet.push({
          attribute: "area_type",
          operator: "EQUALS",
          expected: "URBAN",
          actual: citizenAreaType,
          reason: {
            en: "Scheme is restricted to statutory urban local bodies (ULBs)",
            hi: "यह योजना केवल वैधानिक शहरी क्षेत्रों के लिए है",
            mr: "ही योजना केवळ वैधानिक शहरी भागासाठी (ULB) लागू आहे",
            review_status: "reviewed",
          },
        });
      }
    }

    // Taluka restriction check (data-driven from geo_scope_tokens data, NO hardcoded names)
    if (context.household?.taluka) {
      const userTaluka = context.household.taluka.toUpperCase();
      if (scheme.hard_filters.excluded_talukas && scheme.hard_filters.excluded_talukas.map((t) => t.toUpperCase()).includes(userTaluka)) {
        unmet.push({
          attribute: "taluka",
          operator: "NOT_IN",
          expected: `Excludes: ${scheme.hard_filters.excluded_talukas.join(", ")}`,
          actual: context.household.taluka,
          reason: {
            en: `Taluka '${context.household.taluka}' is excluded from scheme implementing jurisdiction`,
            hi: `तालुका '${context.household.taluka}' योजना के कार्यक्षेत्र से बाहर है`,
            mr: `तालुका '${context.household.taluka}' योजनेच्या कार्यक्षेत्रात येत नाही`,
            review_status: "reviewed",
          },
        });
      }
      if (scheme.hard_filters.included_talukas && scheme.hard_filters.included_talukas.length > 0) {
        if (!scheme.hard_filters.included_talukas.map((t) => t.toUpperCase()).includes(userTaluka)) {
          unmet.push({
            attribute: "taluka",
            operator: "IN",
            expected: scheme.hard_filters.included_talukas.join(", "),
            actual: context.household.taluka,
            reason: {
              en: `Taluka '${context.household.taluka}' is not within scheme implementing jurisdiction`,
              hi: `तालुका '${context.household.taluka}' योजना के कार्यक्षेत्र में नहीं है`,
              mr: `तालुका '${context.household.taluka}' योजनेच्या कार्यक्षेत्रात येत नाही`,
              review_status: "reviewed",
            },
          });
        }
      }
    }

    // District pre-filter check (fully data-driven, NO hardcoded names)
    if (context.household?.district_id && scheme.hard_filters.district_ids && scheme.hard_filters.district_ids.length > 0) {
      const userDistId = context.household.district_id.toUpperCase();
      const userDistName = (context.district_name_by_id?.[context.household.district_id] || "").toUpperCase();
      const candidateUserDists = [userDistId, userDistName].filter(Boolean);

      const allowedDists = scheme.hard_filters.district_ids.map((d) => d.toUpperCase());
      const states = (scheme.hard_filters.states || []).map((s) => s.toUpperCase());
      const matches = allowedDists.some((d) => candidateUserDists.includes(d));
      const isNationwide = states.includes("ALL_INDIA");

      if (!matches && !isNationwide) {
        unmet.push({
          attribute: "district",
          operator: "EQUALS",
          expected: scheme.hard_filters.district_ids.join(", "),
          actual: context.household.district_id,
          reason: {
            en: `District ${context.household.district_id} is not within scheme implementing jurisdiction`,
            hi: `जिला ${context.household.district_id} योजना के कार्यक्षेत्र में नहीं है`,
            mr: `जिल्हा ${context.household.district_id} योजनेच्या कार्यक्षेत्रात येत नाही`,
            review_status: "reviewed",
          },
        });
      }
    }

    // 1. Evaluate Exclusions
    let hasUnknownExclusion = false;
    for (const exclusionNode of scheme.exclusion_rules) {
      const { result, unknown, variant } = this.evalExpression(exclusionNode, subject, context);
      if (variant) matchedVariant = variant;
      if (result === "TRUE") {
        const rawStr = this.formatExpression(exclusionNode);
        exclusionsHit.push({
          raw: rawStr,
          reason: {
            en: `Excluded due to: ${rawStr}`,
            hi: `शर्त के कारण अपात्र: ${rawStr}`,
            mr: `अटीमुळे अपात्र: ${rawStr}`,
            review_status: "reviewed",
          },
        });
      } else if (result === "UNKNOWN") {
        hasUnknownExclusion = true;
        for (const u of unknown) unknownAttrs.add(u);
      }
    }

    if (exclusionsHit.length > 0) {
      const failedOnGeographyOnly =
        unmet.length > 0 &&
        unmet.every((u) =>
          ["district", "district_id", "taluka", "residence_state", "state", "area_type", "nmc_urban_zone"].includes(
            u.attribute
          )
        );

      return {
        scheme_id: scheme.scheme_id,
        status: "NOT_ELIGIBLE",
        seasonal,
        score: 0,
        unmet,
        unknown_attributes: Array.from(unknownAttrs),
        exclusions_hit: exclusionsHit,
        advisories,
        reasons: {
          en: exclusionsHit.map((e) => e.reason.en),
          hi: exclusionsHit.map((e) => e.reason.hi),
          mr: exclusionsHit.map((e) => e.reason.mr),
        },
        review_status: "reviewed",
        failed_on_geography_only: failedOnGeographyOnly,
      };
    }

    // 2. Evaluate compiled rules
    for (const rule of scheme.rules) {
      if (rule.advisory_only) {
        advisories.push({ rule_id: rule.rule_id, note: rule.explanation || rule.attribute });
        continue;
      }

      // OR pathways containing expression arrays
      if (rule.parsed_expressions && rule.parsed_expressions.length > 0) {
        let pathwayPassed = false;
        let pathwayUnknown = false;
        const pathwayUnknowns: string[] = [];

        for (let i = 0; i < rule.parsed_expressions.length; i++) {
          const expr = rule.parsed_expressions[i]!;
          const { result, unknown, variant } = this.evalExpression(expr, subject, context);
          if (result === "TRUE") {
            pathwayPassed = true;
            matchedPathway = `Pathway #${i + 1}`;
            if (variant) matchedVariant = variant;
            break;
          } else if (result === "UNKNOWN") {
            pathwayUnknown = true;
            for (const u of unknown) pathwayUnknowns.push(u);
          }
        }

        if (!pathwayPassed) {
          if (pathwayUnknown) {
            for (const u of pathwayUnknowns) unknownAttrs.add(u);
          } else {
            unmet.push({
              attribute: rule.attribute,
              operator: "OR",
              expected: "At least one qualifying pathway",
              actual: "None matched",
              reason: {
                en: "None of the qualifying alternative criteria were met",
                hi: "कोई भी अर्हक मानदंड पूरा नहीं हुआ",
                mr: "कोणतेही पात्र निकष पूर्ण झाले नाहीत",
                review_status: "machine_drafted" as const,
              },
            });
          }
        }
        continue;
      }

      // Single parsed expression
      if (rule.parsed_expression) {
        const { result, unknown, variant } = this.evalExpression(rule.parsed_expression, subject, context);
        if (variant) matchedVariant = variant;
        if (result === "FALSE") {
          unmet.push({
            attribute: rule.attribute,
            operator: rule.operator,
            expected: rule.value,
            actual: this.resolveAttributeValue(rule.attribute, subject, context),
            reason: this.buildLocalizedReason(rule.attribute, rule.operator, rule.value, subject, context),
          });
        } else if (result === "UNKNOWN") {
          for (const u of unknown) unknownAttrs.add(u);
        }
        continue;
      }

      // Standard comparison rule
      const actualValue = this.resolveAttributeValue(rule.attribute, subject, context);
      if (actualValue === undefined || actualValue === null) {
        unknownAttrs.add(rule.attribute);
        continue;
      }

      const passed = this.compare(actualValue, rule.operator, rule.value);
      if (!passed) {
        unmet.push({
          attribute: rule.attribute,
          operator: rule.operator,
          expected: rule.value,
          actual: actualValue,
          reason: this.buildLocalizedReason(rule.attribute, rule.operator, rule.value, subject, context),
        });
      }
    }

    // Determine final status
    let status: EvaluationStatus = "ELIGIBLE";
    let score = 1.0;

    if (unmet.length > 0) {
      status = "NOT_ELIGIBLE";
      score = 0.0;
    } else if (unknownAttrs.size > 0 || hasUnknownExclusion) {
      status = "UNKNOWN";
      score = 0.5;
    }

    // Build localized reason strings (clean strings without review tags)
    const reasons = {
      en: unmet.length > 0 ? unmet.map((u) => u.reason.en) : ["Eligible for this scheme"],
      hi: unmet.length > 0 ? unmet.map((u) => u.reason.hi) : ["इस योजना के लिए पात्र"],
      mr: unmet.length > 0 ? unmet.map((u) => u.reason.mr) : ["या योजनेसाठी पात्र"],
    };

    const failedOnGeographyOnly =
      unmet.length > 0 &&
      unmet.every((u) =>
        ["district", "district_id", "taluka", "residence_state", "state", "area_type", "nmc_urban_zone"].includes(
          u.attribute
        )
      );

    return {
      scheme_id: scheme.scheme_id,
      status,
      seasonal,
      score,
      variant: matchedVariant,
      matched_pathway: matchedPathway,
      unmet,
      unknown_attributes: Array.from(unknownAttrs),
      exclusions_hit: exclusionsHit,
      advisories,
      reasons,
      review_status: "reviewed",
      failed_on_geography_only: failedOnGeographyOnly,
    };
  }

  private static evalExpression(
    node: ExpressionNode,
    subject: EvaluationSubject,
    context: EvaluationContext
  ): { result: Trilean; unknown: string[]; variant?: string } {
    if (node.type === "binary") {
      const left = this.evalExpression(node.left, subject, context);
      const right = this.evalExpression(node.right, subject, context);
      const variant = left.variant || right.variant;
      const unknown = [...left.unknown, ...right.unknown];

      if (node.operator === "AND") {
        if (left.result === "FALSE" || right.result === "FALSE") {
          return { result: "FALSE", unknown: [], variant };
        }
        if (left.result === "TRUE" && right.result === "TRUE") {
          return { result: "TRUE", unknown: [], variant };
        }
        return { result: "UNKNOWN", unknown, variant };
      } else {
        // OR
        if (left.result === "TRUE" || right.result === "TRUE") {
          return { result: "TRUE", unknown: [], variant };
        }
        if (left.result === "FALSE" && right.result === "FALSE") {
          return { result: "FALSE", unknown: [], variant };
        }
        return { result: "UNKNOWN", unknown, variant };
      }
    }

    if (node.type === "unary" && node.operator === "NOT") {
      const arg = this.evalExpression(node.argument, subject, context);
      let result: Trilean = "UNKNOWN";
      if (arg.result === "TRUE") result = "FALSE";
      else if (arg.result === "FALSE") result = "TRUE";
      return { result, unknown: arg.unknown, variant: arg.variant };
    }

    // Term evaluation
    const { attribute, operator, value } = node;

    // Special pseudo-attribute 'subscheme': acts as a variant marker and always matches
    if (attribute === "subscheme") {
      return { result: "TRUE", unknown: [], variant: String(value) };
    }

    const actual = this.resolveAttributeValue(attribute, subject, context);
    if (actual === undefined || actual === null) {
      return { result: "UNKNOWN", unknown: [attribute] };
    }

    const matches = this.compare(actual, operator, value);
    return { result: matches ? "TRUE" : "FALSE", unknown: [] };
  }

  public static resolveAttributeValue(
    attribute: string,
    subject: EvaluationSubject,
    context: EvaluationContext
  ): unknown {
    // 1. Direct answer in subject
    if (subject.answers[attribute] !== undefined) {
      return subject.answers[attribute];
    }

    // 2. Core subject fields
    if (attribute === "age") return subject.age;
    if (attribute === "gender") return subject.gender;
    if (attribute === "occupation") return subject.occupation;
    if (attribute === "caste_category" || attribute === "social_category") {
      return subject.caste_category || subject.answers["social_category"] || subject.answers["caste_category"];
    }
    if (attribute === "marital_status") return subject.marital_status;

    // 3. Derived attributes from subject
    if (attribute === "is_widow") {
      if (subject.answers["is_widow"] !== undefined) return subject.answers["is_widow"];
      if (subject.marital_status) return subject.marital_status.toUpperCase() === "WIDOW";
    }

    // 4. Data-driven mapping from attribute registry (derived_from_approved_scheme)
    if (context.attribute_parent_mappings && context.attribute_parent_mappings[attribute]) {
      const requiredParentSchemeId = context.attribute_parent_mappings[attribute];
      if (context.approved_parent_benefits?.includes(requiredParentSchemeId)) {
        return true;
      }
    }

    if (attribute.startsWith("has_approved_")) {
      const parentId = attribute.replace("has_approved_", "");
      if (context.approved_parent_benefits?.includes(parentId)) {
        return true;
      }
    }

    // 5. Morphological derivations (negations, gte thresholds, state residence, etc.)
    if (attribute.includes("not_in_")) {
      const posAttr = attribute.replace(/.*not_in_/, "in_");
      const posVal =
        subject.answers[posAttr] ??
        (context.household?.answers && context.household.answers[posAttr]);
      if (posVal !== undefined) return !Boolean(posVal);
    }

    if (attribute.endsWith("_remarried")) {
      if (subject.marital_status?.toUpperCase() === "WIDOW") return false;
    }
    if (attribute.endsWith("_gte")) {
      const baseAttr = attribute.slice(0, -4);
      if (subject.answers[baseAttr] !== undefined) return Number(subject.answers[baseAttr]);
    } else if (subject.answers[`${attribute}_gte`] !== undefined) {
      return Number(subject.answers[`${attribute}_gte`]);
    }

    if (attribute.startsWith("non_") && attribute.includes("_resident")) {
      const st = (subject.answers["residence_state"] || context.household?.state || "").toString().toLowerCase();
      if (st && attribute.toLowerCase().includes(`non_${st}_resident`)) {
        return false;
      }
    }
    if (context.household && (context.household as Record<string, unknown>)[attribute] !== undefined) {
      return (context.household as Record<string, unknown>)[attribute];
    }

    // 5. Household context & derived income/district
    if (context.household) {
      if (context.household.answers && context.household.answers[attribute] !== undefined) {
        return context.household.answers[attribute];
      }
      if (attribute === "annual_family_income" || attribute === "income") return context.household.annual_family_income;
      if (attribute === "monthly_income") return context.household.monthly_income;
      if (attribute === "residence_state" || attribute === "state") return context.household.state;
      if (attribute === "district" || attribute === "district_id") {
        const d = context.household.district_id;
        if (!d) return undefined;
        if (attribute === "district") {
          return context.district_name_by_id?.[d] || d;
        }
        return d;
      }
      if (attribute === "taluka") return context.household.taluka;
    }

    return undefined;
  }

  private static compare(actual: unknown, op: string, expected: unknown): boolean {
    if (op === "EQUALS" || op === "==") {
      if (typeof actual === "string" && typeof expected === "string") {
        return actual.trim().toLowerCase() === expected.trim().toLowerCase();
      }
      return actual === expected;
    }
    if (op === "NOT_EQUALS" || op === "!=") {
      return actual !== expected;
    }
    if (op === "GREATER_THAN_OR_EQUAL" || op === ">=") {
      return Number(actual) >= Number(expected);
    }
    if (op === "LESS_THAN_OR_EQUAL" || op === "<=") {
      return Number(actual) <= Number(expected);
    }
    if (op === "GREATER_THAN" || op === ">") {
      return Number(actual) > Number(expected);
    }
    if (op === "LESS_THAN" || op === "<") {
      return Number(actual) < Number(expected);
    }
    if (op === "IN") {
      if (Array.isArray(expected)) {
        return expected.some((item) =>
          typeof item === "string" && typeof actual === "string"
            ? item.trim().toLowerCase() === actual.trim().toLowerCase()
            : item === actual
        );
      }
      return false;
    }
    if (op === "BETWEEN" && Array.isArray(expected) && expected.length === 2) {
      const min = Number(expected[0]);
      const max = Number(expected[1]);
      const act = Number(actual);
      return act >= min && act <= max;
    }

    return false;
  }

  private static buildLocalizedReason(
    attr: string,
    op: string,
    expected: unknown,
    subject: EvaluationSubject,
    context: EvaluationContext
  ): { en: string; hi: string; mr: string; review_status: "machine_drafted" | "reviewed" } {
    const labels = context.attribute_labels?.[attr] || {
      en: attr.replace(/_/g, " "),
      hi: attr.replace(/_/g, " "),
      mr: attr.replace(/_/g, " "),
    };
    const actual = this.resolveAttributeValue(attr, subject, context) ?? "unknown";

    if (op === "GREATER_THAN_OR_EQUAL" || op === ">=") {
      return {
        en: `${labels.en} must be at least ${String(expected)} (current: ${String(actual)})`,
        hi: `${labels.hi} कम से कम ${String(expected)} होना चाहिए (वर्तमान: ${String(actual)})`,
        mr: `${labels.mr} किमान ${String(expected)} असणे आवश्यक आहे (सध्याचे: ${String(actual)})`,
        review_status: "machine_drafted",
      };
    }
    if (op === "LESS_THAN_OR_EQUAL" || op === "<=") {
      return {
        en: `${labels.en} must be at most ${String(expected)} (current: ${String(actual)})`,
        hi: `${labels.hi} अधिकतम ${String(expected)} होना चाहिए (वर्तमान: ${String(actual)})`,
        mr: `${labels.mr} जास्तीत जास्त ${String(expected)} असावे (सध्याचे: ${String(actual)})`,
        review_status: "machine_drafted",
      };
    }
    if (op === "IN") {
      const expList = Array.isArray(expected) ? expected.join(", ") : String(expected);
      return {
        en: `${labels.en} must be one of [${expList}] (current: ${String(actual)})`,
        hi: `${labels.hi} इनमें से एक होना चाहिए: [${expList}] (वर्तमान: ${String(actual)})`,
        mr: `${labels.mr} यापैकी एक असणे आवश्यक आहे: [${expList}] (सध्याचे: ${String(actual)})`,
        review_status: "machine_drafted",
      };
    }

    return {
      en: `${labels.en} must be ${String(expected)} (current: ${String(actual)})`,
      hi: `${labels.hi} ${String(expected)} होना चाहिए (वर्तमान: ${String(actual)})`,
      mr: `${labels.mr} ${String(expected)} असणे आवश्यक आहे (सध्याचे: ${String(actual)})`,
      review_status: "machine_drafted",
    };
  }

  private static formatExpression(node: ExpressionNode): string {
    if (node.type === "term") {
      return `${node.attribute} ${node.operator} ${JSON.stringify(node.value)}`;
    }
    if (node.type === "binary") {
      return `(${this.formatExpression(node.left)} ${node.operator} ${this.formatExpression(node.right)})`;
    }
    return `NOT (${this.formatExpression(node.argument)})`;
  }
}
