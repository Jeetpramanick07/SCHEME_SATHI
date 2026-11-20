import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAccessibility } from "../../context/AccessibilityContext";
import { useTranslation } from "../../context/I18nContext";
import { useHousehold } from "../../context/HouseholdContext";
import { apiClient } from "../../api/client";
import { AudioReadButton } from "../common/AudioReadButton";
import {
  Trash2,
  ShieldAlert,
  Volume2,
  Eye,
  Type,
  Globe,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Send,
} from "lucide-react";

export const SettingsView: React.FC = () => {
  const {
    textScale,
    setTextScale,
    highContrast,
    setHighContrast,
    audioMode,
    setAudioMode,
    speak,
  } = useAccessibility();

  const { language, setLanguage, t } = useTranslation();
  const { householdId, resetHousehold } = useHousehold();

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSuccess, setSmsSuccess] = useState<string | null>(null);
  const [smsError, setSmsError] = useState<string | null>(null);

  const handleSendTestSms = async () => {
    setIsSendingSms(true);
    setSmsError(null);
    setSmsSuccess(null);
    try {
      const hasRealHousehold = Boolean(
        localStorage.getItem("schemesaathi_access_secret") ||
        localStorage.getItem("schemesaathi_household_secret") ||
        localStorage.getItem("schemesaathi_hh_id")
      );

      if (!hasRealHousehold) {
        setSmsError("No active household in this session. Please screen or claim a household first before sending a test reminder.");
        return;
      }

      await apiClient.sendTestSms({
        household_id: householdId,
        lang: language,
      });

      setSmsSuccess("Test reminder dispatched successfully to SIMULATED inbox! (SIMULATED, not sent)");
      setTimeout(() => setSmsSuccess(null), 6000);
    } catch (err: unknown) {
      setSmsError(err instanceof Error ? err.message : "Failed to send test reminder");
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleDeleteData = async () => {
    if (!window.confirm(t("confirm_delete_all_data"))) return;
    setIsDeleting(true);
    setError(null);
    try {
      await apiClient.deleteHousehold(householdId);
      resetHousehold();
      setDeleteSuccess(true);
      setTimeout(() => setDeleteSuccess(false), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("delete_data_failed"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="border-b pb-6 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
            {t("settings_title")}
          </h1>
          <AudioReadButton text={`${t("settings_title")}. ${t("settings_subtitle")}`} />
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t("settings_subtitle")}
        </p>
      </div>

      <div className="mt-8 space-y-6">
        {/* Language Selection */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="h-5 w-5 text-emerald-600" />
            {t("language_preference")}
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setLanguage("mr")}
              className={`min-h-[48px] rounded-xl border font-bold text-sm transition ${
                language === "mr"
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              मराठी
            </button>
            <button
              type="button"
              onClick={() => setLanguage("hi")}
              className={`min-h-[48px] rounded-xl border font-bold text-sm transition ${
                language === "hi"
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              हिन्दी
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`min-h-[48px] rounded-xl border font-bold text-sm transition ${
                language === "en"
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              English
            </button>
          </div>
        </section>

        {/* Accessibility Preferences */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-600" />
            {t("accessibility_display")}
          </h2>

          {/* Text Scale */}
          <div className="mt-4 border-b border-slate-100 pb-4 dark:border-slate-800">
            <label className="text-xs font-bold uppercase text-slate-500">
              {t("text_size")}
            </label>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setTextScale("normal")}
                className={`min-h-[44px] flex-1 rounded-xl border text-sm font-bold ${
                  textScale === "normal"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
                }`}
              >
                A ({t("normal")})
              </button>
              <button
                type="button"
                onClick={() => setTextScale("large")}
                className={`min-h-[44px] flex-1 rounded-xl border text-base font-bold ${
                  textScale === "large"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
                }`}
              >
                A+ ({t("large")})
              </button>
              <button
                type="button"
                onClick={() => setTextScale("extra-large")}
                className={`min-h-[44px] flex-1 rounded-xl border text-lg font-bold ${
                  textScale === "extra-large"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
                }`}
              >
                A++ ({t("extra_large")})
              </button>
            </div>
          </div>

          {/* High Contrast */}
          <div className="mt-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {t("high_contrast_mode")}
              </p>
              <p className="text-xs text-slate-500">{t("high_contrast_desc")}</p>
            </div>
            <button
              type="button"
              onClick={() => setHighContrast(!highContrast)}
              className={`min-h-[44px] min-w-[70px] rounded-xl px-4 py-2 text-xs font-bold ${
                highContrast
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {highContrast ? t("on") : t("off")}
            </button>
          </div>

          {/* Auto Read Audio Mode */}
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {t("audio_mode_title")}
              </p>
              <p className="text-xs text-slate-500">{t("audio_mode_desc")}</p>
            </div>
            <button
              type="button"
              onClick={() => setAudioMode(!audioMode)}
              className={`min-h-[44px] min-w-[70px] rounded-xl px-4 py-2 text-xs font-bold ${
                audioMode
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {audioMode ? t("on") : t("off")}
            </button>
          </div>
        </section>

        {/* SMS Notifications & Simulated Gateway Testing */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="mt-1 h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    SMS Notifications &amp; Reminders
                  </h2>
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                    SIMULATED
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  SchemeSaathi operates with a default SIMULATED SMS provider for privacy protection and local demonstration. Test reminders are strictly logged without charging carrier networks.
                </p>
              </div>
            </div>

            <Link
              to="/inbox"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 whitespace-nowrap"
            >
              Open Inbox
            </Link>
          </div>

          {smsSuccess && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle className="h-4 w-4" />
              <span>{smsSuccess}</span>
            </div>
          )}

          {smsError && (
            <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              {smsError}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <span className="text-xs text-slate-500">
              Respects citizen consent &amp; 10-digit mobile number
            </span>

            <button
              type="button"
              data-testid="send-test-sms-btn"
              onClick={handleSendTestSms}
              disabled={isSendingSms}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-amber-700 disabled:opacity-50 transition"
            >
              <Send className="h-4 w-4" />
              {isSendingSms ? "Sending..." : "Send test reminder"}
            </button>
          </div>
        </section>

        {/* Right to be Forgotten / Data Deletion */}
        <section className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm dark:border-rose-950 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <Trash2 className="mt-1 h-5 w-5 text-rose-600" />
            <div>
              <h2 className="text-base font-bold text-rose-700 dark:text-rose-400">
                {t("right_to_be_forgotten")}
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t("right_to_be_forgotten_desc")}
              </p>
            </div>
          </div>

          {deleteSuccess && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle className="h-4 w-4" />
              <span>{t("all_data_deleted_success")}</span>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleDeleteData}
              disabled={isDeleting}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-rose-700 disabled:opacity-50 transition"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? t("deleting") : t("delete_all_household_data")}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
