import React, { useState } from "react";
import { useTranslation } from "../../context/I18nContext";
import { AudioReadButton } from "../common/AudioReadButton";
import { VoiceInputButton } from "../common/VoiceInputButton";
import { X, Check, HelpCircle } from "lucide-react";
import type { MemberSchemeResult } from "../../api/types";

interface WhatToConfirmModalProps {
  scheme: MemberSchemeResult;
  onClose: () => void;
  onAnswerSaved: (attributeKey: string, value: unknown) => Promise<void>;
}

export const WhatToConfirmModal: React.FC<WhatToConfirmModalProps> = ({
  scheme,
  onClose,
  onAnswerSaved,
}) => {
  const { t, language } = useTranslation();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [activeValues, setActiveValues] = useState<Record<string, unknown>>({});

  const items = scheme.what_to_confirm || [];

  const handleSave = async (key: string, val: unknown) => {
    setSavingKey(key);
    try {
      await onAnswerSaved(key, val);
      setActiveValues((prev) => ({ ...prev, [key]: val }));
    } finally {
      setSavingKey(null);
    }
  };

  const getLabel = (item: { attribute_key: string; label: string; why_it_matters: string }) => {
    // If translated key exists in dictionary, use it
    const localizedKey = `attr_${item.attribute_key}`;
    const localized = t(localizedKey);
    return localized !== localizedKey ? localized : item.label || item.attribute_key.replace(/_/g, " ");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between border-b pb-4 dark:border-slate-800">
          <div>
            <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
              {t("likely_confirm_title")}
            </span>
            <h2 id="confirm-modal-title" className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {scheme.official_name}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {t("what_to_confirm_desc")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label={t("close")}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {items.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              {t("no_missing_attributes")}
            </div>
          ) : (
            items.map((item) => {
              const label = getLabel(item);
              const readText = `${label}. ${item.why_it_matters}`;
              const isBool = !item.attribute_key.includes("income") &&
                             !item.attribute_key.includes("age") &&
                             !item.attribute_key.includes("count") &&
                             !item.attribute_key.includes("land") &&
                             !item.attribute_key.includes("district");
              const isSaved = activeValues[item.attribute_key] !== undefined;

              return (
                <div
                  key={item.attribute_key}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition dark:border-slate-800 dark:bg-slate-800/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {label}
                        </span>
                        <AudioReadButton text={readText} />
                      </div>
                      {item.why_it_matters && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <HelpCircle className="h-3.5 w-3.5" />
                          {item.why_it_matters}
                        </p>
                      )}
                    </div>
                    {isSaved && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <Check className="h-4 w-4" /> {t("saved")}
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    {isBool ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => handleSave(item.attribute_key, true)}
                          disabled={savingKey === item.attribute_key}
                          className={`min-h-[48px] rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                            activeValues[item.attribute_key] === true
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          }`}
                        >
                          {t("yes")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSave(item.attribute_key, false)}
                          disabled={savingKey === item.attribute_key}
                          className={`min-h-[48px] rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                            activeValues[item.attribute_key] === false
                              ? "border-rose-600 bg-rose-600 text-white"
                              : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          }`}
                        >
                          {t("no")}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder={t("enter_value")}
                          className="min-h-[48px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = parseFloat((e.target as HTMLInputElement).value);
                              if (!isNaN(val)) handleSave(item.attribute_key, val);
                            }
                          }}
                        />
                        <VoiceInputButton
                          expectedType="number"
                          onAccept={(val) => {
                            const num = typeof val === "number" ? val : parseFloat(String(val));
                            if (!isNaN(num)) handleSave(item.attribute_key, num);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 flex justify-end border-t pt-4 dark:border-slate-800">
          <button
            onClick={onClose}
            className="min-h-[48px] rounded-xl bg-slate-900 px-6 py-2.5 font-semibold text-white shadow-md hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {t("done")}
          </button>
        </div>
      </div>
    </div>
  );
};
