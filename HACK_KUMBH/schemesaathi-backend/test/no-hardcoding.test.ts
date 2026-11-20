import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { AdaptiveQuestionnaire, QuestionAttributeMeta } from "../src/engine/next-questions.js";
import { SchemeCompiledRules, EvaluationSubject, EvaluationContext } from "../src/engine/types.js";

describe("Engine Decoupling and Zero Hardcoding", () => {
  const engineDir = path.resolve(process.cwd(), "src/engine");
  const engineFiles = fs
    .readdirSync(engineDir)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => ({
      name: file,
      content: fs.readFileSync(path.join(engineDir, file), "utf-8"),
    }));

  const PLACE_NAMES = [
    "nagpur",
    "maharashtra",
    "gadchiroli",
    "wardha",
    "amravati",
    "chandrapur",
    "bhandara",
    "gondia",
    "akola",
    "yavatmal",
    "buldhana",
    "washim",
    "katol",
    "narkhed",
    "saoner",
    "ramtek",
    "mouda",
    "umred",
    "kuhi",
    "bhiwapur",
    "hingna",
    "parseoni",
  ];

  const DOMAIN_ATTRIBUTES = [
    "owns_cultivable_land",
    "land_recorded_in_state_ror",
    "institutional_landholder",
    "agristack_farmer_id_linked",
    "landholding_hectares",
    "approved_pm_kisan_beneficiary",
    "is_street_vendor",
    "holds_street_vending_id_or_certificate",
    "ulb_vending_recommendation_letter",
    "vending_in_urban_area_prior_to_cutoff",
    "is_pregnant_or_lactating_mother",
    "birth_order_of_child",
    "registered_at_anganwadi_within_first_trimester",
    "self_employed_unorganised_artisan",
    "traditional_trade_category",
    "owns_pucca_house",
    "owns_pucca_house_anywhere_in_india",
    "registered_with_mahabocw_welfare_board",
    "mahabocw_registration_active_1_year",
    "disability_percentage",
    "has_disability",
    "is_disabled",
    "pwd_category",
    "in_bpl_list",
    "belongs_to_bpl_household",
    "household_not_in_bpl_list",
    "ration_card_type",
    "ration_card_type_in",
    "holds_orange_ration_card",
    "holds_yellow_orange_aay_or_white_ration_card",
    "holds_nfsa_ration_card",
    "in_secc_2011_deprivation_database",
    "years_in_maharashtra_gte",
  ];

  it("must contain ZERO place names across all files in src/engine", () => {
    const hits: Array<{ file: string; line: number; match: string }> = [];

    for (const file of engineFiles) {
      const lines = file.content.split("\n");
      lines.forEach((line, idx) => {
        const lower = line.toLowerCase();
        for (const place of PLACE_NAMES) {
          const regex = new RegExp(`\\b${place}\\b`, "i");
          if (regex.test(lower)) {
            hits.push({ file: file.name, line: idx + 1, match: place });
          }
        }
      });
    }

    expect(hits).toEqual([]);
  });

  it("must contain ZERO hardcoded scheme IDs across all files in src/engine", () => {
    const SCHEME_ID_REGEX = /\b(CENT|MH|DIST|LOCAL)-[A-Z0-9-]+\b/g;
    const hits: Array<{ file: string; line: number; match: string }> = [];

    for (const file of engineFiles) {
      const lines = file.content.split("\n");
      lines.forEach((line, idx) => {
        const matches = line.match(SCHEME_ID_REGEX);
        if (matches) {
          matches.forEach((m) => hits.push({ file: file.name, line: idx + 1, match: m }));
        }
      });
    }

    expect(hits).toEqual([]);
  });

  it("must contain ZERO domain attribute names across all files in src/engine", () => {
    const hits: Array<{ file: string; line: number; match: string }> = [];

    for (const file of engineFiles) {
      const lines = file.content.split("\n");
      lines.forEach((line, idx) => {
        for (const attr of DOMAIN_ATTRIBUTES) {
          if (line.includes(`"${attr}"`) || line.includes(`'${attr}'`)) {
            hits.push({ file: file.name, line: idx + 1, match: attr });
          }
        }
      });
    }

    expect(hits).toEqual([]);
  });

  it("proves dynamic gate derivation with a NEW dropped-in scheme that has its own gate", () => {
    // A completely brand-new scheme never seen before, with sequential mandatory AND rules
    // Gate: has_borewell_or_surface_water_source == true
    // Dependent 1: water_source_depth_meters <= 100
    // Dependent 2: micro_irrigation_installed == true
    const newCustomScheme: SchemeCompiledRules = {
      scheme_id: "TEST-SOLAR-PUMP-001",
      rules: [
        {
          rule_id: "TSP-R1",
          attribute: "has_borewell_or_surface_water_source",
          operator: "EQUALS",
          value: true,
          mandatory: true,
          logical_group: "AND",
          advisory_only: false,
        },
        {
          rule_id: "TSP-R2",
          attribute: "water_source_depth_meters",
          operator: "LESS_THAN_OR_EQUAL",
          value: 100,
          mandatory: true,
          logical_group: "AND",
          advisory_only: false,
        },
        {
          rule_id: "TSP-R3",
          attribute: "micro_irrigation_installed",
          operator: "EQUALS",
          value: true,
          mandatory: true,
          logical_group: "AND",
          advisory_only: false,
        },
      ],
      exclusion_rules: [],
      advisories: [],
      hard_filters: {},
      status: "ACTIVE",
      accepting_applications: "YES",
    };

    const mockRegistry = new Map<string, QuestionAttributeMeta>([
      [
        "has_borewell_or_surface_water_source",
        {
          key: "has_borewell_or_surface_water_source",
          scope: "household",
          value_type: "boolean",
          question_text: { en: "Do you have a functional borewell or surface water source on your farm?" },
        },
      ],
      [
        "water_source_depth_meters",
        {
          key: "water_source_depth_meters",
          scope: "household",
          value_type: "number",
          unit: "meters",
          question_text: { en: "What is the water depth in meters?" },
        },
      ],
      [
        "micro_irrigation_installed",
        {
          key: "micro_irrigation_installed",
          scope: "household",
          value_type: "boolean",
          question_text: { en: "Do you have micro-irrigation (drip/sprinkler) installed?" },
        },
      ],
    ]);

    const emptySubject: EvaluationSubject = { answers: {} };
    const emptyContext: EvaluationContext = { household: { answers: {} } };

    // Stage 1: Initial state (gate is unresolved)
    // Only the first gate (has_borewell_or_surface_water_source) should be asked.
    // The follow-up attributes (depth, micro_irrigation) must be suppressed.
    const stage1Questions = AdaptiveQuestionnaire.getNextQuestions(
      emptySubject,
      emptyContext,
      [newCustomScheme],
      mockRegistry,
      5,
      "en"
    );

    expect(stage1Questions.length).toBe(1);
    expect(stage1Questions[0]!.attribute_key).toBe("has_borewell_or_surface_water_source");

    // Stage 2: User answers "false" to the gate
    // The scheme evaluates to NOT_ELIGIBLE; subsequent questions are NEVER asked!
    const negativeSubject: EvaluationSubject = {
      answers: { has_borewell_or_surface_water_source: false },
    };
    const stage2Questions = AdaptiveQuestionnaire.getNextQuestions(
      negativeSubject,
      emptyContext,
      [newCustomScheme],
      mockRegistry,
      5,
      "en"
    );

    expect(stage2Questions.length).toBe(0); // Eliminated! Follow-ups never asked.

    // Stage 3: User answers "true" to the first gate
    // Now the second rule (water_source_depth_meters) becomes the active gate!
    const positiveSubject: EvaluationSubject = {
      answers: { has_borewell_or_surface_water_source: true },
    };
    const stage3Questions = AdaptiveQuestionnaire.getNextQuestions(
      positiveSubject,
      emptyContext,
      [newCustomScheme],
      mockRegistry,
      5,
      "en"
    );

    expect(stage3Questions.length).toBe(1);
    expect(stage3Questions[0]!.attribute_key).toBe("water_source_depth_meters");
  });
});
