import React, { createContext, useContext, useState, useEffect } from "react";
import en from "../i18n/en.json";
import mr from "../i18n/mr.json";
import hi from "../i18n/hi.json";
import { Language, LocalizedText } from "../api/types";

type Dict = typeof en;

const translations: Record<Language, Dict> = {
  en,
  mr: mr as unknown as Dict,
  hi: hi as unknown as Dict,
};

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
  getLocalized: (text?: LocalizedText | string) => { text: string; isFallback: boolean };
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("schemesaathi_lang");
    if (saved === "mr" || saved === "hi" || saved === "en") return saved;
    return "mr"; // Default Marathi for Vidarbha
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("schemesaathi_lang", lang);
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const resolveFromDict = (dict: Record<string, unknown>, keyPath: string): string | null => {
    const parts = keyPath.split(".");
    let curr: unknown = dict;
    for (const p of parts) {
      if (curr && typeof curr === "object" && p in (curr as Record<string, unknown>)) {
        curr = (curr as Record<string, unknown>)[p];
      } else {
        curr = undefined;
        break;
      }
    }
    if (typeof curr === "string") return curr;

    // If single key without dot, look inside immediate child sections
    if (parts.length === 1) {
      for (const sectionVal of Object.values(dict)) {
        if (sectionVal && typeof sectionVal === "object" && parts[0] in sectionVal) {
          const found = (sectionVal as Record<string, unknown>)[parts[0]];
          if (typeof found === "string") return found;
        }
      }
    }
    return null;
  };

  const t = (path: string, params?: Record<string, string | number>): string => {
    const resolved =
      resolveFromDict(translations[language], path) ||
      resolveFromDict(translations.en, path);

    if (!resolved) {
      // Safe friendly fallback: format "some_key_name" to "Some Key Name" so underscores never leak to UI
      const clean = path.includes(".") ? path.split(".").pop() || path : path;
      return clean.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    let res = resolved;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        res = res.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return res;
  };

  const getLocalized = (text?: LocalizedText | string): { text: string; isFallback: boolean } => {
    if (!text) return { text: "", isFallback: false };
    if (typeof text === "string") return { text, isFallback: false };

    if (language === "mr" && text.mr && text.mr.trim().length > 0) {
      return { text: text.mr, isFallback: false };
    }
    if (language === "hi" && text.hi && text.hi.trim().length > 0) {
      return { text: text.hi, isFallback: false };
    }
    if (text.en) {
      const isFallback = language !== "en";
      return { text: text.en, isFallback };
    }
    return { text: text.mr || text.hi || "", isFallback: false };
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, getLocalized }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within an I18nProvider");
  return ctx;
};
