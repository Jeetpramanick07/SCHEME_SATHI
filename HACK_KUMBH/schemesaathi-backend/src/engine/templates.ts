export interface MessageTemplate {
  key: string;
  en: string;
  hi: string;
  mr: string;
  review_status: "machine_drafted" | "reviewed";
  help_text_source?: "dataset" | "unverified";
}

export const MESSAGE_TEMPLATES = {
  MULTIPLE_CASH_BENEFITS: {
    key: "MULTIPLE_CASH_BENEFITS",
    en: "You may be eligible for several cash benefits; some may not be combinable. Confirm with the issuing office.",
    hi: "आप कई नकद लाभों के लिए पात्र हो सकते हैं; हो सकता है कुछ लाभ एक साथ न मिलें। कृपया जारीकर्ता कार्यालय से पुष्टि करें।",
    mr: "तुम्ही एकाधिक रोख लाभांसाठी पात्र असू शकता; त्यातील काही लाभ एकाच वेळी न मिळू शकतील. कृपया संबंधित कार्यालयाकडून खात्री करा.",
    review_status: "reviewed" as const,
    help_text_source: "dataset" as const,
  },
};
