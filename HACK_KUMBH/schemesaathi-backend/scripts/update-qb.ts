import fs from "fs";
import path from "path";

const filePath = path.resolve("src/seed/question-bank.ts");
let content = fs.readFileSync(filePath, "utf8");

// 1. Remove all instances of " [machine-drafted, needs review]"
content = content.replaceAll(" [machine-drafted, needs review]", "");

// 2. Update QuestionBankItem interface
const oldInterface = `export interface QuestionBankItem {
  key: string;
  scope: "member" | "household" | "derived";
  value_type: "boolean" | "number" | "enum" | "string" | "list" | "date";
  enum_values?: string[];
  unit?: string;
  aliases?: string[];
  question_text: {
    en: string;
    hi: string;
    mr: string;
  };
  help_text?: {
    en?: string;
    hi?: string;
    mr?: string;
  };
  derivation?: string;
  status: "curated" | "auto_registered";
}`;

const newInterface = `export interface QuestionBankItem {
  key: string;
  scope: "member" | "household" | "derived";
  value_type: "boolean" | "number" | "enum" | "string" | "list" | "date";
  enum_values?: string[];
  unit?: string;
  aliases?: string[];
  question_text: {
    en: string;
    hi: string;
    mr: string;
  };
  help_text?: {
    en?: string;
    hi?: string;
    mr?: string;
  };
  derivation?: string;
  derived_from_approved_scheme?: string;
  review_status?: "machine_drafted" | "reviewed";
  help_text_source?: "dataset" | "unverified";
  status: "curated" | "auto_registered";
}`;

if (content.includes(oldInterface)) {
  content = content.replace(oldInterface, newInterface);
}

// 3. Update social_category to include PREFER_NOT_TO_SAY
content = content.replace(
  'enum_values: ["SC", "ST", "OBC", "VJNT", "SBC", "GENERAL", "NEO_BUDDHIST"],',
  'enum_values: ["SC", "ST", "OBC", "VJNT", "SBC", "GENERAL", "NEO_BUDDHIST", "PREFER_NOT_TO_SAY"],'
);

// 4. Update approved_pm_kisan_beneficiary_in_maharashtra to add derived_from_approved_scheme
content = content.replace(
  'aliases: ["pm_kisan_approved"],',
  'aliases: ["pm_kisan_approved"],\n    derived_from_approved_scheme: "CENT-MOAFW-PMKISAN-001",'
);

// 5. Add area_type item if not already present
if (!content.includes('key: "area_type"')) {
  const areaTypeItem = `  {
    key: "area_type",
    scope: "household",
    value_type: "enum",
    enum_values: ["URBAN", "RURAL", "URBAN_SLUM"],
    aliases: ["area", "habitation_type", "location_type"],
    question_text: {
      en: "Do you live in an urban city, rural village, or urban slum area?",
      hi: "क्या आप शहरी नगर, ग्रामीण गाँव अथवा शहरी मलिन बस्ती (झोपड़पट्टी) में रहते हैं?",
      mr: "तुम्ही शहरी भागात, ग्रामीण गावात की शहरी झोपडपट्टीत राहता?",
    },
    help_text: {
      en: "Schemes like PMAY-Urban 2.0 and DAY-NULM are strictly for urban areas, while PMAY-G is for rural areas.",
      hi: "पीएम आवास शहरी और दीनदयाल अंत्योदय जैसी योजनाएं केवल शहरी व स्लम क्षेत्रों के लिए हैं।",
      mr: "पीएम आवास शहरी आणि दीनदयाल अंत्योदय यांसारख्या योजना केवळ नागरी व झोपडपट्टी भागांसाठी आहेत.",
    },
    review_status: "machine_drafted",
    help_text_source: "dataset",
    status: "curated",
  },
`;
  content = content.replace("export const QUESTION_BANK: QuestionBankItem[] = [", `export const QUESTION_BANK: QuestionBankItem[] = [\n${areaTypeItem}`);
}

fs.writeFileSync(filePath, content, "utf8");
console.log("Successfully updated question-bank.ts");
