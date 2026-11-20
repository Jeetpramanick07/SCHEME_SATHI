import { simplifyForLowLiteracy } from "./large-text.js";

export interface SchemeAudioScript {
  scheme_id: string;
  lang: "mr" | "hi";
  spoken_script: string;
  estimated_duration_seconds: number;
}

export type SchemeAudioSource = {
  scheme_id: string;
  official_name: string;
  translated_names?: { en?: string; hi?: string; mr?: string };
  overview?: {
    simple_explanation?: { en?: string; hi?: string; mr?: string };
    objective?: string;
  };
  benefits?: {
    benefit_type?: string;
    amount?: number | string;
    currency?: string;
    frequency?: string;
    coverage_details?: string;
  };
  documents_required?: Array<{
    document_id?: string;
    mandatory?: boolean;
  }>;
  assistance?: {
    helpline?: string;
  };
};

const COMMON_AMOUNTS: Record<number, { mr: string; hi: string }> = {
  300: { mr: "तीनशे रुपये", hi: "तीन सौ रुपये" },
  375: { mr: "तीनशे पंच्याहत्तर रुपये", hi: "तीन सौ पचहत्तर रुपये" },
  500: { mr: "पाचशे रुपये", hi: "पांच सौ रुपये" },
  625: { mr: "सहाशे पंचवीस रुपये", hi: "छह सौ पच्चीस रुपये" },
  1000: { mr: "एक हजार रुपये", hi: "एक हजार रुपये" },
  1500: { mr: "दीड हजार रुपये", hi: "पंद्रह सौ रुपये" },
  2000: { mr: "दोन हजार रुपये", hi: "दो हजार रुपये" },
  2500: { mr: "अडीच हजार रुपये", hi: "पच्चीस सौ रुपये" },
  3000: { mr: "तीन हजार रुपये", hi: "तीन हजार रुपये" },
  5000: { mr: "पाच हजार रुपये", hi: "पांच हजार रुपये" },
  6000: { mr: "सहा हजार रुपये", hi: "छह हजार रुपये" },
  7000: { mr: "सात हजार रुपये", hi: "सात हजार रुपये" },
  8000: { mr: "आठ हजार रुपये", hi: "आठ हजार रुपये" },
  10000: { mr: "दहा हजार रुपये", hi: "दस हजार रुपये" },
  15000: { mr: "पंधरा हजार रुपये", hi: "पंद्रह हजार रुपये" },
  20000: { mr: "वीस हजार रुपये", hi: "बीस हजार रुपये" },
  25000: { mr: "पंचवीस हजार रुपये", hi: "पच्चीस हजार रुपये" },
  30000: { mr: "तीस हजार रुपये", hi: "तीस हजार रुपये" },
  50000: { mr: "पन्नास हजार रुपये", hi: "पचास हजार रुपये" },
  75000: { mr: "पंच्याहत्तर हजार रुपये", hi: "पिचहत्तर हजार रुपये" },
  78000: { mr: "अठ्ठ्याहत्तर हजार रुपये", hi: "अठहत्तर हजार रुपये" },
  100000: { mr: "एक लाख रुपये", hi: "एक लाख रुपये" },
  101000: { mr: "एक लाख एक हजार रुपये", hi: "एक लाख एक हजार रुपये" },
  120000: { mr: "एक लाख वीस हजार रुपये", hi: "एक लाख बीस हजार रुपये" },
  130000: { mr: "एक लाख तीस हजार रुपये", hi: "एक लाख तीस हजार रुपये" },
  142000: { mr: "एक लाख बेचाळीस हजार रुपये", hi: "एक लाख बयालीस हजार रुपये" },
  200000: { mr: "दोन लाख रुपये", hi: "दो लाख रुपये" },
  250000: { mr: "दोन लाख पन्नास हजार रुपये", hi: "दो लाख पचास हजार रुपये" },
  300000: { mr: "तीन लाख रुपये", hi: "तीन लाख रुपये" },
  500000: { mr: "पाच लाख रुपये", hi: "पांच लाख रुपये" },
};

export function convertAmountToDevanagariWords(amount: number | string, lang: "mr" | "hi"): string {
  const num = typeof amount === "number" ? amount : parseInt(String(amount).replace(/[^0-9]/g, ""), 10);
  if (!num || isNaN(num)) {
    return lang === "mr" ? "आर्थिक मदत" : "वित्तीय सहायता";
  }

  if (COMMON_AMOUNTS[num]) {
    return COMMON_AMOUNTS[num]![lang];
  }

  if (num >= 100000) {
    const lakhs = Math.floor(num / 100000);
    const rem = num % 100000;
    const lakhWord = lang === "mr" ? `${lakhs} लाख रुपये` : `${lakhs} लाख रुपये`;
    if (rem > 0) {
      const thousands = Math.floor(rem / 1000);
      return `${lakhs} लाख ${thousands} हजार रुपये`;
    }
    return lakhWord;
  }

  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    return `${thousands} हजार रुपये`;
  }

  return `${num} रुपये`;
}

const DIGIT_WORDS: Record<string, { mr: string; hi: string }> = {
  "0": { mr: "शून्य", hi: "शून्य" },
  "1": { mr: "एक", hi: "एक" },
  "2": { mr: "दोन", hi: "दो" },
  "3": { mr: "तीन", hi: "तीन" },
  "4": { mr: "चार", hi: "चार" },
  "5": { mr: "पाच", hi: "पांच" },
  "6": { mr: "सहा", hi: "छह" },
  "7": { mr: "सात", hi: "सात" },
  "8": { mr: "आठ", hi: "आठ" },
  "9": { mr: "नऊ", hi: "नौ" },
};

export function convertHelplineToSpoken(rawHelpline: string, lang: "mr" | "hi"): string {
  const numbers = rawHelpline.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
  const spokenNumbers: string[] = [];

  for (const numStr of numbers) {
    let groups = numStr.split(/[- ]+/).filter(Boolean);
    if (groups.length === 1) {
      const digits = groups[0]!.replace(/[^0-9]/g, "");
      if (digits.length <= 4) {
        groups = [digits];
      } else if (digits.length === 5) {
        groups = [digits.slice(0, 2), digits.slice(2)];
      } else if (digits.length === 6) {
        groups = [digits.slice(0, 3), digits.slice(3)];
      } else if (digits.length === 10) {
        groups = [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7)];
      } else {
        groups = digits.match(/.{1,3}/g) || [digits];
      }
    }

    const spokenGroups = groups.map((grp) => {
      return grp
        .split("")
        .map((ch) => DIGIT_WORDS[ch]?.[lang] || ch)
        .join(" ");
    });

    spokenNumbers.push(spokenGroups.join(", "));
  }

  const separator = lang === "mr" ? " किंवा " : " या ";
  return spokenNumbers.join(separator);
}

function getBenefitSpokenText(
  benefitType: string | undefined,
  spokenAmount: string,
  lang: "mr" | "hi"
): string {
  const isMr = lang === "mr";
  const typeUpper = (benefitType || "").toUpperCase();

  if (typeUpper.includes("INSURANCE") || typeUpper.includes("HEALTH")) {
    return isMr
      ? `ही योजना कुटुंबासाठी ${spokenAmount} मोफत आरोग्य विमा संरक्षण प्रदान करते.`
      : `यह योजना परिवार के लिए ${spokenAmount} की मुफ्त स्वास्थ्य बीमा सुरक्षा प्रदान करती है।`;
  }
  if (typeUpper.includes("SUBSIDY")) {
    return isMr
      ? `ही योजना ${spokenAmount} थेट सरकारी अनुदान सबसिडी प्रदान करते.`
      : `यह योजना ${spokenAmount} की सीधी सरकारी अनुदान सहायता प्रदान करती है।`;
  }
  if (typeUpper.includes("CREDIT") || typeUpper.includes("LOAN")) {
    return isMr
      ? `ही योजना व्यवसायासाठी ${spokenAmount} पर्यंत सुलभ कर्ज सहाय्य प्रदान करते.`
      : `यह योजना व्यवसाय के लिए ${spokenAmount} तक का आसान ऋण सहयोग प्रदान करती है।`;
  }
  if (typeUpper.includes("EDUCATION") || typeUpper.includes("STIPEND")) {
    return isMr
      ? `ही योजना शिक्षणासाठी आणि प्रशिक्षणासाठी ${spokenAmount} सहाय्य प्रदान करते.`
      : `यह योजना पढ़ाई और प्रशिक्षण के लिए ${spokenAmount} की सहायता प्रदान करती है।`;
  }
  // Default cash / financial
  return isMr
    ? `ही योजना ${spokenAmount} थेट आर्थिक सहाय्य प्रदान करते.`
    : `यह योजना ${spokenAmount} की सीधी वित्तीय सहायता प्रदान करती है।`;
}

/**
 * Clean Latin words and technical symbols from spoken texts
 */
function cleanDevanagariText(text: string): string {
  return text
    .replace(/\bPM-KISAN\b/gi, "पीएम-किसान")
    .replace(/\bPM-JAY\b/gi, "पीएम-जय")
    .replace(/\bPM-SYM\b/gi, "पीएम-श्रम योगी")
    .replace(/\bPMAY-U\b/gi, "पीएम आवास")
    .replace(/\bPMAY-G\b/gi, "पीएम आवास ग्रामीण")
    .replace(/\bPMAY\b/gi, "पीएम आवास")
    .replace(/\bPMMVY\b/gi, "मातृ वंदना")
    .replace(/\bDMF\b/gi, "जिल्हा खनिकर्म प्रतिष्ठान")
    .replace(/\bEBC\b/gi, "ईबीसी")
    .replace(/\bPoCRA\b/gi, "पोकरा")
    .replace(/\bMAHABOCW\b/gi, "महाबोकव")
    .replace(/\bNSAP\b/gi, "राष्ट्रीय सामाजिक सहाय्य")
    .replace(/\bDBT\b/gi, "थेट बँक लाभ")
    .replace(/\bBPL\b/gi, "दारिद्र्य रेषा")
    .replace(/\bMJPJAY\b/gi, "महात्मा फुले जन आरोग्य")
    .replace(/\bCSC\b/gi, "सीएससी")
    .replace(/\be-KYC\b/gi, "ई-केवायसी")
    .replace(/\bKYC\b/gi, "केवायसी")
    .replace(/\bUDID\b/gi, "युडीआयडी")
    .replace(/\bCAP\b/gi, "कॅप")
    .replace(/\bULB\b/gi, "स्थानिक संस्था")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds a natural, conversational Devanagari spoken script designed specifically
 * for AI4Bharat Indic Parler-TTS with Sunita's warm and slow speech style.
 */
export function generateSpokenScript(
  scheme: {
    scheme_id: string;
    official_name: string;
    translated_names?: { en?: string; hi?: string; mr?: string };
    overview?: {
      simple_explanation?: { en?: string; hi?: string; mr?: string };
      objective?: string;
    };
    benefits?: {
      benefit_type?: string;
      amount?: number | string;
      currency?: string;
      frequency?: string;
      coverage_details?: string;
    };
    documents_required?: Array<{
      document_id?: string;
      mandatory?: boolean;
    }>;
    assistance?: {
      helpline?: string;
    };
  },
  lang: "mr" | "hi" = "mr"
): SchemeAudioScript {
  const isMr = lang === "mr";
  const rawTitle = (scheme.translated_names && scheme.translated_names[lang]) || scheme.official_name;
  const title = cleanDevanagariText(rawTitle);

  const rawExplanation =
    scheme.overview?.simple_explanation?.[lang] ||
    (isMr ? "शासकीय कल्याणकारी योजना." : "सरकारी कल्याणकारी योजना।");

  let cleanExplanation = cleanDevanagariText(simplifyForLowLiteracy(rawExplanation, lang));

  // Neutralize any "you will receive" / "मिळतात" / "मिलते हैं" phrasing
  if (isMr) {
    cleanExplanation = cleanExplanation
      .replace(/तुम्हाला\s+मिळतात/g, "प्रदान केले जातात")
      .replace(/तुम्हाला\s+मिळते/g, "प्रदान केले जाते")
      .replace(/मिळतात/g, "उपलब्ध आहेत")
      .replace(/मिळते/g, "प्रदान केले जाते")
      .replace(/तुम्हाला/g, "नागरिकांना");
  } else {
    cleanExplanation = cleanExplanation
      .replace(/आपको\s+मिलते\s+हैं/g, "प्रदान किए जाते हैं")
      .replace(/आपको\s+मिलती\s+है/g, "प्रदान की जाती है")
      .replace(/आपको\s+मिलता\s+है/g, "प्रदान किया जाता है")
      .replace(/मिलते\s+हैं/g, "उपलब्ध हैं")
      .replace(/मिलती\s+है/g, "प्रदान की जाती है")
      .replace(/मिलता\s+है/g, "प्रदान किया जाता है")
      .replace(/आपको/g, "नागरिकों को");
  }

  // Benefit segment (using spoken Devanagari words and template by benefit_type)
  let benefitText = "";
  if (scheme.benefits?.amount) {
    const spokenAmount = convertAmountToDevanagariWords(scheme.benefits.amount, lang);
    benefitText = getBenefitSpokenText(scheme.benefits.benefit_type, spokenAmount, lang);
  } else {
    benefitText = isMr
      ? "ही योजना शासनाकडून विशेष योजना लाभ प्रदान करते."
      : "यह योजना सरकार द्वारा विशेष योजना लाभ प्रदान करती है।";
  }

  // Documents segment
  const docCount = scheme.documents_required?.filter((d) => d.mandatory !== false).length || 3;
  const spokenDocCount = isMr
    ? docCount === 2 ? "दोन" : docCount === 3 ? "तीन" : "काही"
    : docCount === 2 ? "दो" : docCount === 3 ? "तीन" : "कुछ";

  const docText = isMr
    ? `अर्ज करण्यासाठी आधार कार्ड, रेशन कार्ड आणि बँक खात्याचा पुरावा अशी सुमारे ${spokenDocCount} कागदपत्रे लागतील.`
    : `आवेदन करने के लिए आधार कार्ड, राशन कार्ड और बैंक पासबुक जैसे लगभग ${spokenDocCount} दस्तावेज़ आवश्यक हैं।`;

  // Assistance segment - Helpline digits spoken as grouped numbers
  const helpline = scheme.assistance?.helpline;
  const cleanHelpline = helpline ? String(helpline).replace(/[^0-9,-/ ]/g, "").trim() : "";
  const spokenHelpline = cleanHelpline ? convertHelplineToSpoken(cleanHelpline, lang) : "";
  const helplineText = spokenHelpline
    ? isMr
      ? `अधिक माहितीसाठी हेल्पलाइन क्रमांक ${spokenHelpline} वर संपर्क करा किंवा जवळच्या आपले सरकार केंद्रात जा.`
      : `अधिक जानकारी के लिए हेल्पलाइन नंबर ${spokenHelpline} पर कॉल करें या नजदीकी सीएससी केंद्र पर जाएं।`
    : isMr
    ? `अधिक माहितीसाठी आपल्या ग्रामपंचायत किंवा आपले सरकार केंद्रात संपर्क साधा.`
    : `अधिक जानकारी के लिए अपने ग्राम पंचायत या सीएससी केंद्र पर संपर्क करें।`;

  // Full conversational spoken script with parentheses stripped and periods normalized
  let rawScript = isMr
    ? `नमस्कार. ${title} बद्दल माहिती ऐका. ${cleanExplanation}. ${benefitText} ${docText} ${helplineText}`
    : `नमस्ते। ${title} के बारे में जानकारी सुनें। ${cleanExplanation}। ${benefitText} ${docText} ${helplineText}`;

  // 1. Strip parentheses
  rawScript = rawScript.replace(/[()]/g, "");

  // 2. Strip duplicate periods / dandas
  rawScript = rawScript
    .replace(/\.{2,}/g, ".")
    .replace(/।{2,}/g, "।")
    .replace(/\.\s*\./g, ".")
    .replace(/।\s*।/g, "।")
    .replace(/\s+/g, " ")
    .trim();

  // 3. Fail build if any Latin word >3 letters remains
  const latinMatch = rawScript.match(/[a-zA-Z]{4,}/);
  if (latinMatch) {
    throw new Error(
      `[generateSpokenScript] Forbidden Latin word with >3 letters found in ${lang} script: "${latinMatch[0]}" inside "${rawScript}"`
    );
  }

  // Average reading speed: ~2.8 words per second for slow elderly-friendly TTS
  const wordCount = rawScript.split(/\s+/).length;
  const estimatedSeconds = Math.max(Math.round(wordCount / 2.8), 5);

  return {
    scheme_id: scheme.scheme_id,
    lang,
    spoken_script: rawScript,
    estimated_duration_seconds: estimatedSeconds,
  };
}
