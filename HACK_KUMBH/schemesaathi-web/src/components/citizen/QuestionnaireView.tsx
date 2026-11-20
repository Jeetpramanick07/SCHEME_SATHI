import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../context/I18nContext";
import { useHousehold } from "../../context/HouseholdContext";
import { api, ApiError } from "../../api/client";
import { NextQuestionItem, ProfileSection } from "../../api/types";
import { AudioReadButton } from "../common/AudioReadButton";
import { VoiceInputButton } from "../common/VoiceInputButton";
import { detectSensitiveId } from "../../lib/sensitive-id";
import {
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  ListOrdered,
  Loader2,
  FileText,
  BadgeAlert
} from "lucide-react";

export const QuestionnaireView: React.FC = () => {
  const { language, t, getLocalized } = useTranslation();
  const {
    answers,
    setAnswer,
    districtId,
    taluka,
    state,
    consistencyWarnings,
    clearWarnings,
  } = useHousehold();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"adaptive" | "section">("adaptive");
  const [questions, setQuestions] = useState<NextQuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [sections, setSections] = useState<ProfileSection[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string>("");

  // Input states
  const [inputValue, setInputValue] = useState<string | number | boolean | null>(null);
  const [sensitiveWarning, setSensitiveWarning] = useState<string | null>(null);
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  const [hasMrVoice, setHasMrVoice] = useState<boolean | null>(null);

  // Check speech synthesis Marathi voice support on device
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setHasMrVoice(false);
      return;
    }
    const checkVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const found = voices.some(
          (v) =>
            v.lang.toLowerCase().startsWith("mr") ||
            v.lang.toLowerCase().replace("_", "-").startsWith("mr-in") ||
            v.name.toLowerCase().includes("marathi")
        );
        setHasMrVoice(found);
      }
    };
    checkVoice();
    window.speechSynthesis.onvoiceschanged = checkVoice;
  }, []);

  // Load next questions for adaptive mode
  const fetchNextQuestions = async () => {
    setIsLoadingQuestions(true);
    setApiErrorMessage(null);
    try {
      const res = await api.getNextQuestions({
        household: { district_id: districtId, taluka, state },
        answers,
        limit: 10,
        lang: language,
      });

      const qList = Array.isArray(res) ? res : (res as any)?.questions || [];
      if (qList && qList.length > 0) {
        const mapped = qList.map((q: any) => ({
          ...q,
          question_text: q.question_text || q.question_translations || {
            mr: q.question || q.attribute_key,
            hi: q.question || q.attribute_key,
            en: q.question || q.attribute_key,
          },
          help_text: typeof q.help_text === "string"
            ? { mr: q.help_text, hi: q.help_text, en: q.help_text }
            : q.help_text,
          resolved_scheme_count: q.resolved_scheme_count ?? q.schemes_affected ?? 0,
          rank_score: q.rank_score ?? q.impact_score ?? 0,
        }));
        setQuestions(mapped);
        setCurrentIndex(0);
      } else {
        // Fallback standard questionnaire if next-questions empty
        setQuestions(getFallbackQuestions());
      }
    } catch {
      // Fallback questions on network failure
      setQuestions(getFallbackQuestions());
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  // Load profile sections for section mode
  const fetchSections = async () => {
    try {
      const res = await api.getProfileSections(language);
      if (res.sections && res.sections.length > 0) {
        setSections(res.sections);
        setActiveSectionId(res.sections[0]?.id || "");
      }
    } catch {}
  };

  useEffect(() => {
    fetchNextQuestions();
    fetchSections();
  }, [language]);

  const currentQ = questions[currentIndex];

  // Initialize input value when question changes
  useEffect(() => {
    if (currentQ) {
      const existing = answers[currentQ.attribute_key];
      setInputValue(existing !== undefined ? (existing as string | number | boolean) : null);
      setSensitiveWarning(null);
      setApiErrorMessage(null);
    }
  }, [currentQ, answers]);

  const handleInputChange = (val: string | number | boolean | null) => {
    // Sensitive ID guard
    const check = detectSensitiveId(val);
    if (check.detected) {
      setSensitiveWarning(check.message || t("questionnaire.sensitive_id_alert"));
      return;
    }
    setSensitiveWarning(null);
    setInputValue(val);
  };

  const handleSaveAndNext = async (valToSave: unknown) => {
    if (!currentQ) return;

    // Check sensitive ID
    const check = detectSensitiveId(valToSave);
    if (check.detected) {
      setSensitiveWarning(check.message || t("questionnaire.sensitive_id_alert"));
      return;
    }

    try {
      await setAnswer(currentQ.attribute_key, valToSave);

      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // Fetch new adaptive batch or navigate to results
        await fetchNextQuestions();
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "SENSITIVE_ID_NOT_ALLOWED") {
        setSensitiveWarning(err.message);
      } else {
        setApiErrorMessage("Failed to save answer. Please retry.");
      }
    }
  };

  const handleSkip = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      navigate("/results");
    }
  };

  const handleDontKnow = async () => {
    // Null maps to UNKNOWN in engine
    await handleSaveAndNext(null);
  };

  const localizedQ = currentQ ? getLocalized(currentQ.question_text) : { text: "", isFallback: false };
  const localizedHelp = currentQ?.help_text ? getLocalized(currentQ.help_text) : null;
  const readAloudContent = `${localizedQ.text}. ${localizedHelp?.text || ""}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Mode Switcher & "See schemes for me" Bar */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setMode("adaptive")}
            data-testid="mode-adaptive-btn"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              mode === "adaptive"
                ? "bg-blue-700 text-white shadow-xs"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t("questionnaire.adaptive_mode")}</span>
          </button>
          <button
            onClick={() => setMode("section")}
            data-testid="mode-section-btn"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              mode === "section"
                ? "bg-blue-700 text-white shadow-xs"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t("questionnaire.section_mode")}</span>
          </button>
        </div>

        <button
          onClick={() => navigate("/results")}
          data-testid="see-schemes-btn"
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors min-h-tap"
        >
          <span>{t("questionnaire.see_schemes", { count: Object.keys(answers).length })}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Device SpeechSynthesis Voice Check Warning */}
      {hasMrVoice === false && (
        <div
          role="status"
          data-testid="no-mr-voice-warning"
          className="bg-amber-50 border-2 border-amber-300 text-amber-950 p-4 rounded-2xl flex items-start gap-3 shadow-xs"
        >
          <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-bold uppercase tracking-wider text-amber-900">
              मराठी आवाज उपलब्ध नाही / No Marathi Voice Installed
            </p>
            <p className="mt-0.5 text-amber-800">
              या डिव्हाइसवर मराठी उच्चाराचा आवाज आढळला नाही. प्रणाली डीफॉल्ट आवाजाचा वापर करेल. व्हॉइस तपासणीसाठी{" "}
              <button
                type="button"
                onClick={() => navigate("/diagnostics")}
                className="underline font-bold text-blue-800 hover:text-blue-950 inline"
              >
                /diagnostics
              </button>{" "}
              पहा.
            </p>
          </div>
        </div>
      )}

      {/* Gentle Consistency Warning Hint from Backend */}
      {consistencyWarnings.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 text-amber-950 p-4 rounded-2xl flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                खात्री करा / Verification Hint
              </p>
              <p className="text-sm font-semibold mt-0.5">
                {consistencyWarnings[0]}
              </p>
            </div>
          </div>
          <button
            onClick={clearWarnings}
            className="text-xs font-bold text-amber-800 hover:underline px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sensitive ID Security Alert Banner */}
      {sensitiveWarning && (
        <div className="bg-red-50 border-2 border-red-500 text-red-950 p-4 rounded-2xl flex items-start gap-3 shadow-xs animate-in shake">
          <BadgeAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-red-800">
              सुरक्षा इशारा / Sensitive ID Alert
            </p>
            <p className="text-sm font-semibold mt-0.5">{sensitiveWarning}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {apiErrorMessage && (
        <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs font-semibold">
          {apiErrorMessage}
        </div>
      )}

      {/* SECTION MODE VIEW */}
      {mode === "section" && sections.length > 0 && (
        <div className="space-y-4">
          {/* Section Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSectionId(sec.id)}
                className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors min-h-tap ${
                  activeSectionId === sec.id
                    ? "bg-blue-700 text-white border-blue-700 shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {getLocalized(sec.title).text}
              </button>
            ))}
          </div>

          {/* Active Section Fields List */}
          {(() => {
            const currentSec = sections.find((s) => s.id === activeSectionId) || sections[0];
            if (!currentSec) return null;
            return (
              <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 space-y-6 shadow-sm">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {getLocalized(currentSec.title).text}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {getLocalized(currentSec.description).text}
                  </p>
                </div>

                <div className="space-y-5">
                  {currentSec.fields.map((field) => {
                    const qText = getLocalized(field.question_text).text;
                    const val = answers[field.attribute_key];
                    return (
                      <div
                        key={field.attribute_key}
                        className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <label className="text-sm font-bold text-slate-900 flex-1">
                            {qText}
                          </label>
                          <AudioReadButton text={qText} size="sm" />
                        </div>

                        {field.help_text && (
                          <p className="text-xs text-slate-500">
                            {getLocalized(field.help_text).text}
                          </p>
                        )}

                        {/* Input rendering based on value_type */}
                        {field.value_type === "boolean" ? (
                          <div className="flex items-center gap-3" data-testid={`section-field-${field.attribute_key}`}>
                            <button
                              type="button"
                              data-testid={`btn-yes-${field.attribute_key}`}
                              onClick={() => setAnswer(field.attribute_key, true)}
                              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm border-2 min-h-tap ${
                                val === true
                                  ? "border-emerald-600 bg-emerald-100 text-emerald-950 font-black shadow-xs"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {t("questionnaire.yes")}
                            </button>
                            <button
                              type="button"
                              data-testid={`btn-no-${field.attribute_key}`}
                              onClick={() => setAnswer(field.attribute_key, false)}
                              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm border-2 min-h-tap ${
                                val === false
                                  ? "border-emerald-600 bg-emerald-100 text-emerald-950 font-black shadow-xs"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {t("questionnaire.no")}
                            </button>
                          </div>
                        ) : field.value_type === "number" ? (
                          <input
                            type="number"
                            data-testid={`input-${field.attribute_key}`}
                            value={val !== undefined ? String(val) : ""}
                            onChange={(e) => {
                              const num = e.target.value ? parseFloat(e.target.value) : "";
                              setAnswer(field.attribute_key, num);
                            }}
                            placeholder={t("questionnaire.enter_number")}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-600 focus:outline-hidden font-bold text-slate-900 bg-white min-h-tap"
                          />
                        ) : field.enum_values && field.enum_values.length > 0 ? (
                          <select
                            data-testid={`select-${field.attribute_key}`}
                            value={val !== undefined ? String(val) : ""}
                            onChange={(e) => setAnswer(field.attribute_key, e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-600 focus:outline-hidden font-bold text-slate-900 bg-white min-h-tap"
                          >
                            <option value="">-- {t("questionnaire.select_option")} --</option>
                            {field.enum_values.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            data-testid={`input-${field.attribute_key}`}
                            value={val !== undefined ? String(val) : ""}
                            onChange={(e) => setAnswer(field.attribute_key, e.target.value)}
                            placeholder={t("questionnaire.enter_text")}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-600 focus:outline-hidden font-bold text-slate-900 bg-white min-h-tap"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ADAPTIVE MODE VIEW: ONE QUESTION PER SCREEN */}
      {mode === "adaptive" && (
        <>
          {isLoadingQuestions ? (
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-12 text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-700 mx-auto" />
              <p className="text-sm font-bold text-slate-600">
                Finding the most important questions for your family...
              </p>
            </div>
          ) : currentQ ? (
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md relative">
              {/* Question Header & Counter */}
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold border-b border-slate-100 pb-3">
                <span className="flex items-center gap-1.5">
                  <ListOrdered className="w-4 h-4 text-blue-700" />
                  <span>
                    {t("questionnaire.question_counter", {
                      current: currentIndex + 1,
                      total: questions.length,
                    })}
                  </span>
                </span>

                {/* Number of schemes unlocked by this question */}
                {currentQ.resolved_scheme_count > 0 && (
                  <span className="bg-blue-100 text-blue-900 px-2.5 py-0.5 rounded-full text-[11px] font-black">
                    {t("questionnaire.required_for", { count: currentQ.resolved_scheme_count })}
                  </span>
                )}
              </div>

              {/* Question Text & Read Aloud Audio Button */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                    {localizedQ.text}
                  </h2>
                  <AudioReadButton text={readAloudContent} autoPlay={true} size="md" />
                </div>

                {/* Translation Fallback Notice */}
                {localizedQ.isFallback && (
                  <span className="inline-block text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    {t("language.shown_in_english")}
                  </span>
                )}

                {/* Help Text / Explanation */}
                {localizedHelp?.text && (
                  <p className="text-xs sm:text-sm text-slate-600 font-medium">
                    {localizedHelp.text}
                  </p>
                )}
              </div>

              {/* Answer Input Controls: Min 56px Tap Targets */}
              <div className="space-y-4 pt-2">
                {currentQ.value_type === "boolean" ? (
                  <div className="grid grid-cols-2 gap-3.5">
                    <button
                      type="button"
                      data-testid="adaptive-btn-yes"
                      onClick={() => handleSaveAndNext(true)}
                      className={`py-4 px-6 rounded-2xl font-black text-lg border-2 transition-all min-h-tap flex items-center justify-center gap-2 ${
                        inputValue === true
                          ? "border-emerald-600 bg-emerald-100 text-emerald-950 shadow-md ring-2 ring-emerald-600/20"
                          : "border-slate-200 bg-slate-50 text-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50"
                      }`}
                    >
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      <span>{t("questionnaire.yes")}</span>
                    </button>

                    <button
                      type="button"
                      data-testid="adaptive-btn-no"
                      onClick={() => handleSaveAndNext(false)}
                      className={`py-4 px-6 rounded-2xl font-black text-lg border-2 transition-all min-h-tap flex items-center justify-center gap-2 ${
                        inputValue === false
                          ? "border-red-600 bg-red-100 text-red-950 shadow-md ring-2 ring-red-600/20"
                          : "border-slate-200 bg-slate-50 text-slate-800 hover:border-red-500 hover:bg-red-50/50"
                      }`}
                    >
                      <span className="w-6 h-6 rounded-full border-2 border-red-600 text-red-600 flex items-center justify-center font-bold text-xs">
                        ✕
                      </span>
                      <span>{t("questionnaire.no")}</span>
                    </button>
                  </div>
                ) : currentQ.value_type === "number" ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        data-testid="adaptive-number-input"
                        value={inputValue !== null ? String(inputValue) : ""}
                        onChange={(e) => handleInputChange(e.target.value ? parseFloat(e.target.value) : "")}
                        placeholder={t("questionnaire.enter_number")}
                        className="flex-1 px-4 py-3.5 rounded-2xl border-2 border-slate-300 focus:border-blue-600 focus:outline-hidden font-black text-xl text-slate-900 bg-white min-h-tap"
                      />
                      <VoiceInputButton
                        expectedType="number"
                        onAccept={(v) => handleSaveAndNext(v)}
                      />
                    </div>
                    {currentQ.unit && (
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        Unit: {currentQ.unit}
                      </span>
                    )}
                  </div>
                ) : currentQ.enum_values && currentQ.enum_values.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentQ.enum_values.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        data-testid={`adaptive-opt-${opt}`}
                        onClick={() => handleSaveAndNext(opt)}
                        className={`p-3.5 text-left rounded-2xl border-2 font-bold text-sm transition-all min-h-tap flex items-center justify-between ${
                          inputValue === opt
                            ? "border-blue-600 bg-blue-50 text-blue-950 shadow-xs ring-2 ring-blue-600/20"
                            : "border-slate-200 bg-slate-50 text-slate-800 hover:border-blue-300"
                        }`}
                      >
                        <span>{opt}</span>
                        {inputValue === opt && (
                          <CheckCircle2 className="w-5 h-5 text-blue-700" />
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={inputValue !== null ? String(inputValue) : ""}
                      onChange={(e) => handleInputChange(e.target.value)}
                      placeholder={t("questionnaire.enter_text")}
                      className="flex-1 px-4 py-3.5 rounded-2xl border-2 border-slate-300 focus:border-blue-600 focus:outline-hidden font-bold text-base text-slate-900 bg-white min-h-tap"
                    />
                    <VoiceInputButton
                      expectedType="string"
                      onAccept={(v) => handleSaveAndNext(v)}
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons: Next / Skip / Don't Know */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {currentIndex > 0 && (
                    <button
                      onClick={() => setCurrentIndex(currentIndex - 1)}
                      type="button"
                      className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1 min-h-tap"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>{t("questionnaire.previous")}</span>
                    </button>
                  )}
                  <button
                    onClick={handleDontKnow}
                    type="button"
                    className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors min-h-tap"
                  >
                    {t("questionnaire.dont_know")}
                  </button>
                  <button
                    onClick={handleSkip}
                    type="button"
                    className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors min-h-tap"
                  >
                    {t("questionnaire.skip")}
                  </button>
                </div>

                {currentQ.value_type !== "boolean" && (
                  <button
                    onClick={() => handleSaveAndNext(inputValue)}
                    type="button"
                    data-testid="adaptive-next-btn"
                    disabled={inputValue === null || inputValue === ""}
                    className="px-6 py-3 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center gap-2 min-h-tap"
                  >
                    <span>{t("questionnaire.next")}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-xl font-black text-slate-900">
                You have answered the primary screening questions!
              </h3>
              <p className="text-sm text-slate-600">
                Check your eligibility results now or review additional profile sections.
              </p>
              <button
                onClick={() => navigate("/results")}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-md min-h-tap"
              >
                {t("questionnaire.see_schemes", { count: Object.keys(answers).length })}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Standard Fallback Question Bank if network is offline or next-questions empty
function getFallbackQuestions(): NextQuestionItem[] {
  return [
    {
      attribute_key: "age",
      question_text: {
        mr: "तुमचे वय किती वर्षे आहे?",
        hi: "आपकी आयु कितने वर्ष है?",
        en: "What is your age in years?",
      },
      help_text: {
        mr: "कुटुंबप्रमुखाचे किंवा अर्जदाराचे वय टाका",
        en: "Enter age of applicant",
      },
      value_type: "number",
      scope: "member",
      resolved_scheme_count: 14,
      rank_score: 95,
    },
    {
      attribute_key: "gender",
      question_text: {
        mr: "तुमचे लिंग काय आहे?",
        hi: "आपका लिंग क्या है?",
        en: "What is your gender?",
      },
      value_type: "enum",
      enum_values: ["FEMALE", "MALE", "TRANSGENDER"],
      scope: "member",
      resolved_scheme_count: 12,
      rank_score: 90,
    },
    {
      attribute_key: "is_widow",
      question_text: {
        mr: "तुम्ही विधवा आहात का?",
        hi: "क्या आप विधवा हैं?",
        en: "Are you a widow?",
      },
      help_text: {
        mr: "संजय गांधी निराधार व इतर पेन्शन योजनांसाठी आवश्यक",
        en: "Required for widow pension and welfare programs",
      },
      value_type: "boolean",
      scope: "member",
      resolved_scheme_count: 6,
      rank_score: 85,
    },
    {
      attribute_key: "in_bpl_list",
      question_text: {
        mr: "तुमचे नाव दारिद्र्यरेषेखालील (BPL) यादीत आहे का किंवा तुमच्याकडे पिवळे/केशरी रेशन कार्ड आहे का?",
        hi: "क्या आपका परिवार बीपीएल (BPL) सूची में है या आपके पास बीपीएल राशन कार्ड है?",
        en: "Does your family belong to BPL category or hold a BPL/Yellow/Orange ration card?",
      },
      value_type: "boolean",
      scope: "household",
      resolved_scheme_count: 10,
      rank_score: 80,
    },
    {
      attribute_key: "annual_family_income",
      question_text: {
        mr: "तुमचे वार्षिक कौटुंबिक उत्पन्न किती रुपये आहे?",
        hi: "आपकी वार्षिक पारिवारिक आय कितने रुपये है?",
        en: "What is your annual family income in Rupees?",
      },
      value_type: "number",
      scope: "household",
      resolved_scheme_count: 15,
      rank_score: 75,
    },
    {
      attribute_key: "years_in_maharashtra",
      question_text: {
        mr: "तुम्ही महाराष्ट्रात किती वर्षांपासून राहत आहात?",
        hi: "आप महाराष्ट्र में कितने वर्षों से रह रहे हैं?",
        en: "How many years have you lived in Maharashtra?",
      },
      value_type: "number",
      scope: "household",
      resolved_scheme_count: 8,
      rank_score: 70,
    },
  ];
}
