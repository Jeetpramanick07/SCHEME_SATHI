export type TextSizeTier = "STANDARD" | "LARGE" | "EXTRA_LARGE";

export interface LargeTextConfig {
  tier: TextSizeTier;
  fontSizeRem: number;
  lineHeight: number;
  fontWeight: number | string;
  letterSpacingEm: number;
  highContrast: boolean;
  backgroundColor: string;
  textColor: string;
  badgeColor: string;
}

export const TEXT_SIZE_PRESETS: Record<TextSizeTier, LargeTextConfig> = {
  STANDARD: {
    tier: "STANDARD",
    fontSizeRem: 1.0, // 16px
    lineHeight: 1.5,
    fontWeight: "normal",
    letterSpacingEm: 0,
    highContrast: false,
    backgroundColor: "#FFFFFF",
    textColor: "#1A202C",
    badgeColor: "#2B6CB0",
  },
  LARGE: {
    tier: "LARGE",
    fontSizeRem: 1.375, // 22px
    lineHeight: 1.7,
    fontWeight: 500,
    letterSpacingEm: 0.02,
    highContrast: true,
    backgroundColor: "#FFFFFA",
    textColor: "#111111",
    badgeColor: "#C53030",
  },
  EXTRA_LARGE: {
    tier: "EXTRA_LARGE",
    fontSizeRem: 1.875, // 30px
    lineHeight: 1.9,
    fontWeight: 700,
    letterSpacingEm: 0.04,
    highContrast: true,
    backgroundColor: "#FFFFFF",
    textColor: "#000000",
    badgeColor: "#9B2C2C",
  },
};

/**
 * Common bureaucratic phrases mapped to colloquial everyday spoken terms
 * for low-literacy citizens in rural and semi-urban Maharashtra.
 * Rules put the replacement first in alternation to guarantee idempotency.
 */
const MARATHI_SIMPLIFICATIONS: Array<[RegExp, string]> = [
  [/(?:महाराष्ट्रात १५ वर्षे राहिल्याचा दाखला \(डोमिसाईल\)|अधिवास प्रमाणपत्र)/g, "महाराष्ट्रात १५ वर्षे राहिल्याचा दाखला (डोमिसाईल)"],
  [/(?:बँकेत थेट पैसे जमा होणे|थेट लाभ हस्तांतरण|डीबीटी|\bDBT\b)/gi, "बँकेत थेट पैसे जमा होणे"],
  [/(?:दारिद्र्यरेषेखालील \(पिवळे\/बीपीएल\) रेशन कार्ड असलेले कुटुंब|दारिद्र्यरेषेखालील कुटुंब|दारिद्र्यरेषेखालील \(BPL\)|\bBPL\b)/gi, "दारिद्र्यरेषेखालील (पिवळे/बीपीएल) रेशन कार्ड असलेले कुटुंब"],
  [/(?:कंपनी किंवा संस्थेच्या नावावर असलेले शेत|संस्थात्मक भूधारक)/g, "कंपनी किंवा संस्थेच्या नावावर असलेले शेत"],
  [/(?:महानगरपालिका किंवा नगरपालिका|शहरी स्थानिक स्वराज्य संस्था|\bULB\b)/gi, "महानगरपालिका किंवा नगरपालिका"],
  [/(?:आधार कार्डचे बँकेत केलेले व्हेरिफिकेशन|ई-केवायसी|\be-KYC\b)/gi, "आधार कार्डचे बँकेत केलेले व्हेरिफिकेशन"],
  [/(?:स्वावलंबन \(UDID\) दिव्यांग कार्ड|दिव्यांगता प्रमाणपत्र|\bUDID\b)/gi, "स्वावलंबन (UDID) दिव्यांग कार्ड"],
  [/(?:संपूर्ण कुटुंबाची वर्षाची कमाई|वार्षिक कौटुंबिक उत्पन्न)/g, "संपूर्ण कुटुंबाची वर्षाची कमाई"],
  [/(?:जमिनीचा अधिकृत ७\/१२ \(सातबारा\) उतारा|सातबारा उतारा|७\/१२)/g, "जमिनीचा अधिकृत ७/१२ (सातबारा) उतारा"],
  [/(?:शासकीय मेरिट यादीतील \(CAP\) प्रवेश|केंद्रीभूत प्रवेश प्रक्रिया|\bCAP\b राउंड)/gi, "शासकीय मेरिट यादीतील (CAP) प्रवेश"],
];

const HINDI_SIMPLIFICATIONS: Array<[RegExp, string]> = [
  [/(?:राज्य में रहने का पक्का प्रमाण पत्र \(निवास प्रमाण पत्र\)|अधिवास प्रमाण पत्र|निवास प्रमाण पत्र)/g, "राज्य में रहने का पक्का प्रमाण पत्र (निवास प्रमाण पत्र)"],
  [/(?:बैंक खाते में सीधे पैसे आना|प्रत्यक्ष लाभ अंतरण|डीबीटी|\bDBT\b)/gi, "बैंक खाते में सीधे पैसे आना"],
  [/(?:गरीबी रेखा \(बीपीएल\/पीला\) राशन कार्ड|गरीबी रेखा से नीचे \(BPL\)|\bBPL\b)/gi, "गरीबी रेखा (बीपीएल/पीला) राशन कार्ड"],
  [/(?:कंपनी या ट्रस्ट के नाम पर दर्ज खेती|संस्थागत भूमिधारक)/g, "कंपनी या ट्रस्ट के नाम पर दर्ज खेती"],
  [/(?:नगर निगम या नगर पालिका|शहरी स्थानीय निकाय|\bULB\b)/gi, "नगर निगम या नगर पालिका"],
  [/(?:आधार कार्ड का फिंगरप्रिंट या ओटीपी सत्यापन|ई-केवाईसी|\be-KYC\b)/gi, "आधार कार्ड का फिंगरप्रिंट या ओटीपी सत्यापन"],
  [/(?:दिव्यांगता प्रमाण पत्र \(UDID कार्ड\)|दिव्यांगता प्रमाण पत्र|\bUDID\b)/gi, "दिव्यांगता प्रमाण पत्र (UDID कार्ड)"],
  [/(?:पूरे परिवार की एक साल की कुल कमाई|वार्षिक पारिवारिक आय)/g, "पूरे परिवार की एक साल की कुल कमाई"],
  [/(?:खेती की सरकारी खतौनी या जमीन के कागजात|भूलेख \/ खतौनी)/g, "खेती की सरकारी खतौनी या जमीन के कागजात"],
];

/**
 * Simplifies bureaucratic terms in Devanagari text so that citizens with low formal
 * literacy can easily understand either by reading large text or listening via TTS.
 */
export function simplifyForLowLiteracy(text: string, lang: "mr" | "hi" = "mr"): string {
  let simplified = text;
  const rules = lang === "mr" ? MARATHI_SIMPLIFICATIONS : HINDI_SIMPLIFICATIONS;
  for (const [pattern, replacement] of rules) {
    simplified = simplified.replace(pattern, replacement);
  }
  return simplified;
}

export interface AccessibleCardViewModel {
  scheme_id: string;
  display_title: string;
  badge_benefit: string;
  plain_explanation: string;
  spoken_summary_script: string;
  documents_bullet_list: string[];
  help_centre_note: string;
  audio_stream_url: string;
  accessibility: {
    tier: TextSizeTier;
    config: LargeTextConfig;
    font_size_rem?: number;
    container_css?: string;
    listen_button_label: string;
    has_precomputed_audio: boolean;
  };
}

/**
 * Generates an accessible, high-contrast, large-font card view model
 * with embedded spoken-script metadata for senior citizens.
 */
export function buildAccessibleCard(
  scheme: {
    scheme_id: string;
    title: string;
    benefit_amount?: string | number;
    benefit_frequency?: string;
    explanation: string;
    documents: string[];
    help_centre?: string;
    has_precomputed_audio?: boolean;
  },
  lang: "mr" | "hi" = "mr",
  tier: TextSizeTier = "LARGE"
): AccessibleCardViewModel {
  const plainText = simplifyForLowLiteracy(scheme.explanation, lang);
  const config = TEXT_SIZE_PRESETS[tier];

  const listenLabel = lang === "mr" ? "🔊 मोठ्याने ऐका (ऑडिओ)" : "🔊 बोलकर सुनें (ऑडियो)";
  const benefitLabel = scheme.benefit_amount
    ? `${lang === "mr" ? "आर्थिक मदत" : "वित्तीय सहायता"}: ₹${scheme.benefit_amount} ${scheme.benefit_frequency || ""}`
    : lang === "mr"
    ? "शासकीय योजना लाभ"
    : "सरकारी योजना लाभ";

  const spokenScript =
    lang === "mr"
      ? `${scheme.title}. ${plainText}. आवश्यक कागदपत्रे: ${scheme.documents.join(", ")}.`
      : `${scheme.title}. ${plainText}. आवश्यक दस्तावेज: ${scheme.documents.join(", ")}.`;

  return {
    scheme_id: scheme.scheme_id,
    display_title: scheme.title,
    badge_benefit: benefitLabel,
    plain_explanation: plainText,
    spoken_summary_script: spokenScript,
    documents_bullet_list: scheme.documents.map((d) => simplifyForLowLiteracy(d, lang)),
    help_centre_note:
      scheme.help_centre ||
      (lang === "mr"
        ? "मदतीसाठी जवळच्या आपले सरकार किंवा ग्रामपंचायत केंद्राशी संपर्क साधा."
        : "सहायता के लिए नजदीकी सीएससी या ग्राम पंचायत केंद्र से संपर्क करें।"),
    audio_stream_url: `/api/v1/voice/schemes/${scheme.scheme_id}/audio?lang=${lang}`,
    accessibility: {
      tier,
      config,
      font_size_rem: config.fontSizeRem,
      container_css: `accessible-card-${tier.toLowerCase().replace(/_/g, "-")}`,
      listen_button_label: listenLabel,
      has_precomputed_audio: Boolean(scheme.has_precomputed_audio),
    },
  };
}
