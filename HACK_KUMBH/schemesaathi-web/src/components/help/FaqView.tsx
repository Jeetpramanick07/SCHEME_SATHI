import React, { useState, useEffect } from "react";
import { useTranslation } from "../../context/I18nContext";
import { apiClient } from "../../api/client";
import { AudioReadButton } from "../common/AudioReadButton";
import { Search, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import type { FaqItem } from "../../api/types";

export const FaqView: React.FC = () => {
  const { t, language } = useTranslation();
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadFaqs() {
      try {
        setLoading(true);
        const data = await apiClient.getFaqs({ lang: language });
        if (isMounted) setFaqs(data);
      } catch (err) {
        console.error("Failed to load FAQs", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadFaqs();
    return () => {
      isMounted = false;
    };
  }, [language]);

  const filtered = faqs.filter((faq) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      faq.question.toLowerCase().includes(q) ||
      faq.answer.toLowerCase().includes(q) ||
      (faq.scheme_name && faq.scheme_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="border-b pb-6 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
            {t("faq_title")}
          </h1>
          <AudioReadButton text={`${t("faq_title")}. ${t("faq_subtitle")}`} />
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t("faq_subtitle")}
        </p>
      </div>

      <div className="mt-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("search_faqs_placeholder")}
            className="min-h-[48px] w-full rounded-xl border border-slate-300 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {loading && (
          <div className="py-12 text-center text-sm text-slate-500">
            {t("loading_faqs")}...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-800">
            {t("no_faqs_found")}
          </div>
        )}

        {filtered.map((faq) => {
          const isExpanded = expandedId === faq.id;
          return (
            <div
              key={faq.id}
              className="rounded-xl border border-slate-200 bg-white shadow-sm transition dark:border-slate-800 dark:bg-slate-900"
            >
              <div
                onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                className="flex cursor-pointer items-center justify-between p-4"
              >
                <div className="flex items-start gap-3 flex-1">
                  <HelpCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      {faq.question}
                    </h2>
                    {faq.scheme_name && (
                      <span className="mt-1 inline-block text-[11px] font-semibold text-slate-500">
                        {faq.scheme_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AudioReadButton
                    text={`${faq.question}. ${faq.answer}`}
                    className="p-1"
                  />
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300 leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
