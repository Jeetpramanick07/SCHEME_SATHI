export interface BaseAttributeSeed {
  key: string;
  scope: "member" | "household" | "derived";
  value_type: "boolean" | "number" | "enum" | "string" | "list" | "date";
  enum_values?: string[];
  unit?: string;
  aliases?: string[];
  question_text: { en: string; hi?: string; mr?: string };
  help_text?: { en?: string; hi?: string; mr?: string };
  derivation?: string;
  status: "curated" | "auto_registered";
}

export const BASE_ATTRIBUTES: BaseAttributeSeed[] = [
  {
    key: "age",
    scope: "member",
    value_type: "number",
    unit: "years",
    aliases: ["applicant_age", "member_age"],
    question_text: {
      en: "What is your age in years?",
      hi: "आपकी आयु कितने वर्ष है?",
      mr: "तुमचे वय किती वर्षे आहे?",
    },
    help_text: {
      en: "Enter age as shown on Aadhaar or birth certificate",
      hi: "आधार कार्ड या जन्म प्रमाण पत्र के अनुसार आयु दर्ज करें",
      mr: "आधार कार्ड किंवा जन्म दाखल्यानुसार वय प्रविष्ट करा",
    },
    derivation: "derived from date_of_birth where available",
    status: "curated",
  },
  {
    key: "gender",
    scope: "member",
    value_type: "enum",
    enum_values: ["FEMALE", "MALE", "TRANSGENDER"],
    aliases: ["sex"],
    question_text: {
      en: "What is your gender?",
      hi: "आपका लिंग क्या है?",
      mr: "तुमचे लिंग काय आहे?",
    },
    status: "curated",
  },
  {
    key: "marital_status",
    scope: "member",
    value_type: "enum",
    enum_values: ["MARRIED", "UNMARRIED", "WIDOW", "DIVORCED", "ABANDONED"],
    aliases: ["marital_status_in"],
    question_text: {
      en: "What is your marital status?",
      hi: "आपकी वैवाहिक स्थिति क्या है?",
      mr: "तुमची वैवाहिक स्थिती काय आहे?",
    },
    status: "curated",
  },
  {
    key: "annual_family_income",
    scope: "household",
    value_type: "number",
    unit: "INR",
    aliases: ["family_income", "annual_income", "annual_family_income_lte_800000"],
    question_text: {
      en: "What is your total annual family income in Rupees?",
      hi: "आपकी कुल वार्षिक पारिवारिक आय कितनी है?",
      mr: "तुमचे एकूण वार्षिक कौटुंबिक उत्पन्न किती आहे?",
    },
    help_text: {
      en: "As stated on your official Tehsildar Income Certificate",
      hi: "तहसीलदार द्वारा जारी आय प्रमाण पत्र के अनुसार",
      mr: "तहसीलदार यांनी दिलेल्या उत्पन्न दाखल्यानुसार",
    },
    status: "curated",
  },
  {
    key: "monthly_income",
    scope: "household",
    value_type: "number",
    unit: "INR",
    aliases: ["monthly_income_lte_15000"],
    question_text: {
      en: "What is your monthly household income?",
      hi: "आपकी मासिक घरेलू आय कितनी है?",
      mr: "तुमचे मासिक कौटुंबिक उत्पन्न किती आहे?",
    },
    status: "curated",
  },
  {
    key: "residence_state",
    scope: "household",
    value_type: "string",
    aliases: ["state"],
    question_text: {
      en: "Which state do you permanently reside in?",
      hi: "आप स्थायी रूप से किस राज्य में रहते हैं?",
      mr: "तुम्ही कोणत्या राज्यात कायमचे वास्तव्यास आहात?",
    },
    status: "curated",
  },
  {
    key: "district",
    scope: "household",
    value_type: "string",
    aliases: ["district_id", "home_district"],
    question_text: {
      en: "Which district do you live in?",
      hi: "आप किस जिले में रहते हैं?",
      mr: "तुम्ही कोणत्या जिल्ह्यात राहता?",
    },
    status: "curated",
  },
  {
    key: "taluka",
    scope: "household",
    value_type: "string",
    aliases: ["taluka_in", "tehsil"],
    question_text: {
      en: "Which taluka / tehsil do you live in?",
      hi: "आप किस तहसील में रहते हैं?",
      mr: "तुम्ही कोणत्या तालुक्यात राहता?",
    },
    status: "curated",
  },
  {
    key: "occupation",
    scope: "member",
    value_type: "string",
    question_text: {
      en: "What is your occupation or livelihood source?",
      hi: "आपका मुख्य व्यवसाय या आजीविका का साधन क्या है?",
      mr: "तुमचा मुख्य व्यवसाय किंवा उपजीविकेचे साधन काय आहे?",
    },
    status: "curated",
  },
  {
    key: "caste_category",
    scope: "member",
    value_type: "enum",
    enum_values: ["OPEN", "OBC", "SC", "ST", "VJNT", "SBC", "EWS"],
    aliases: ["caste", "social_category"],
    question_text: {
      en: "What is your social / caste category?",
      hi: "आपकी सामाजिक / जाति श्रेणी क्या है?",
      mr: "तुमचा सामाजिक / जात प्रवर्ग कोणता आहे?",
    },
    status: "curated",
  },
  {
    key: "owns_cultivable_land",
    scope: "member",
    value_type: "boolean",
    question_text: {
      en: "Do you or your family own cultivable agricultural land in your name?",
      hi: "क्या आपके या आपके परिवार के नाम पर खेती योग्य जमीन है?",
      mr: "तुमच्या किंवा कुटुंबाच्या नावावर लागवडीयोग्य शेतजमीन आहे का?",
    },
    status: "curated",
  },
  {
    key: "is_widow",
    scope: "member",
    value_type: "boolean",
    question_text: {
      en: "Are you a widow?",
      hi: "क्या आप विधवा हैं?",
      mr: "तुम्ही विधवा आहात का?",
    },
    status: "curated",
  },
  {
    key: "disability_percentage",
    scope: "member",
    value_type: "number",
    unit: "%",
    question_text: {
      en: "What is your certified percentage of disability (if any)?",
      hi: "आपकी दिव्यांगता का प्रमाणित प्रतिशत क्या है?",
      mr: "तुमचे प्रमाणित दिव्यांगत्व किती टक्के आहे?",
    },
    status: "curated",
  },
  {
    key: "belongs_to_bpl_household",
    scope: "household",
    value_type: "boolean",
    aliases: ["in_bpl_list", "bpl_card_holder"],
    question_text: {
      en: "Does your family hold a BPL, Antyodaya (AAY), or Yellow ration card?",
      hi: "क्या आपके पास बीपीएल, अंत्योदय या पीला राशन कार्ड है?",
      mr: "तुमच्याकडे बीपीएल, अंत्योदय (AAY) किंवा पिवळे रेशन कार्ड आहे का?",
    },
    status: "curated",
  },
  {
    key: "owns_pucca_house_anywhere_in_india",
    scope: "household",
    value_type: "boolean",
    aliases: ["owns_pucca_house"],
    question_text: {
      en: "Does anyone in your household own a pucca (permanent concrete/brick) house anywhere in India?",
      hi: "क्या आपके परिवार के किसी सदस्य के पास भारत में कहीं भी पक्का मकान है?",
      mr: "तुमच्या कुटुंबातील कोणाच्याही नावावर भारतात कुठेही पक्के घर आहे का?",
    },
    status: "curated",
  },
  {
    key: "is_unorganised_worker",
    scope: "member",
    value_type: "boolean",
    question_text: {
      en: "Are you an unorganised sector worker or daily wage earner?",
      hi: "क्या आप असंगठित क्षेत्र के श्रमिक या दैनिक वेतनभोगी हैं?",
      mr: "तुम्ही असंघटित क्षेत्रातील कामगार किंवा रोजंदारी कामगार आहात का?",
    },
    status: "curated",
  },
  {
    key: "years_in_maharashtra_gte",
    scope: "household",
    value_type: "number",
    unit: "years",
    question_text: {
      en: "How many continuous years have you resided in Maharashtra?",
      hi: "आप महाराष्ट्र में कितने वर्षों से निवास कर रहे हैं?",
      mr: "तुम्ही महाराष्ट्रात किती वर्षांपासून वास्तव्यास आहात?",
    },
    status: "curated",
  },
];
