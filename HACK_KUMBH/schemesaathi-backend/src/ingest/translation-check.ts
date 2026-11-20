export type TranslationFieldStatus = "ok" | "placeholder" | "missing";

export interface TranslationAuditResult {
  status: {
    en: TranslationFieldStatus;
    hi: TranslationFieldStatus;
    mr: TranslationFieldStatus;
  };
  issues: Array<{
    field: string;
    lang: "hi" | "mr";
    reason: string;
  }>;
}

export class TranslationChecker {
  private static PLACEHOLDER_PATTERNS = [
    /\[.+\]/, // Bracketed tokens e.g. [योजनेचे नाव]
    /पात्र लाभार्थियों के लिए सरकारी कल्याणकारी योजना/,
    /पात्र लाभार्थ्यांसाठी शासकीय कल्याणकारी योजना/,
    /सरकारी कल्याणकारी योजना/,
    /शासकीय कल्याणकारी योजना/,
  ];

  static auditMultilingualField(
    fieldName: string,
    texts?: { en?: string | null; hi?: string | null; mr?: string | null }
  ): TranslationAuditResult {
    const enText = texts?.en?.trim() || "";
    const hiText = texts?.hi?.trim() || "";
    const mrText = texts?.mr?.trim() || "";

    const enStatus: TranslationFieldStatus = enText.length > 0 ? "ok" : "missing";
    let hiStatus: TranslationFieldStatus = "ok";
    let mrStatus: TranslationFieldStatus = "ok";
    const issues: Array<{ field: string; lang: "hi" | "mr"; reason: string }> = [];

    // Check Hindi
    if (hiText.length === 0) {
      hiStatus = "missing";
      issues.push({ field: fieldName, lang: "hi", reason: "Missing Hindi translation" });
    } else if (enText.length > 0 && hiText === enText) {
      hiStatus = "placeholder";
      issues.push({ field: fieldName, lang: "hi", reason: "Hindi text is identical to English" });
    } else if (this.matchesPlaceholder(hiText)) {
      hiStatus = "placeholder";
      issues.push({ field: fieldName, lang: "hi", reason: "Generic placeholder template detected in Hindi" });
    }

    // Check Marathi
    if (mrText.length === 0) {
      mrStatus = "missing";
      issues.push({ field: fieldName, lang: "mr", reason: "Missing Marathi translation" });
    } else if (enText.length > 0 && mrText === enText) {
      mrStatus = "placeholder";
      issues.push({ field: fieldName, lang: "mr", reason: "Marathi text is identical to English" });
    } else if (this.matchesPlaceholder(mrText)) {
      mrStatus = "placeholder";
      issues.push({ field: fieldName, lang: "mr", reason: "Generic placeholder template detected in Marathi" });
    }

    return {
      status: {
        en: enStatus,
        hi: hiStatus,
        mr: mrStatus,
      },
      issues,
    };
  }

  private static matchesPlaceholder(text: string): boolean {
    for (const pattern of this.PLACEHOLDER_PATTERNS) {
      if (pattern.test(text)) return true;
    }
    return false;
  }
}
