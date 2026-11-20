import React, { useState } from "react";
import { useHousehold } from "../../context/HouseholdContext";
import { useTranslation } from "../../context/I18nContext";
import { AudioReadButton } from "../common/AudioReadButton";
import { apiClient } from "../../api/client";
import { Link, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  CheckCircle,
  Copy,
  ArrowRight,
  Phone,
  FileCheck,
  AlertTriangle,
} from "lucide-react";

export const SaveClaimFlow: React.FC = () => {
  const { householdId } = useHousehold();
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [consentProcessing, setConsentProcessing] = useState(true);
  const [consentSms, setConsentSms] = useState(true);
  const [consentVolunteer, setConsentVolunteer] = useState(true);
  const [declarationAgreed, setDeclarationAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const declarationText = {
    mr: "मी याद्वारे घोषित करतो/करते की मी दिलेली माहिती माझ्या माहितीनुसार खरी आणि अचूक आहे. मला समजले आहे की ही एक सहाय्यक पडताळणी प्रणाली आहे आणि अंतिम निर्णय संबंधित शासकीय कार्यालयाचा असेल.",
    hi: "मैं घोषणा करता/करती हूँ कि मेरे द्वारा दी गई जानकारी मेरे सर्वोत्तम ज्ञान के अनुसार सत्य और सटीक है। मैं समझता/समझती हूँ कि यह एक सहायक स्क्रीनिंग प्रणाली है और अंतिम निर्णय सरकारी कार्यालय का होगा।",
    en: "I hereby declare that the information provided is true and accurate to the best of my knowledge. I understand this is an assistive screening tool and the final decision rests with the respective government authority.",
  }[language] || "I hereby declare that the information provided is true and accurate.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declarationAgreed) {
      setError(t("must_agree_declaration"));
      return;
    }
    if (!phone || phone.replace(/\D/g, "").length !== 10) {
      setError(t("valid_10_digit_phone_required"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiClient.claimHousehold({
        answers: { phone_number: phone },
        consent: {
          data_processing: consentProcessing,
          sms_reminders: consentSms,
          volunteer_assist: consentVolunteer,
        },
      });

      setClaimToken(response.auth_token || response.household_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("claim_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = () => {
    if (claimToken) {
      navigator.clipboard.writeText(claimToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {claimToken ? (
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 sm:p-8 shadow-xl text-center dark:border-emerald-900/60 dark:bg-slate-900">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle className="h-10 w-10" />
          </div>

          <h2 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">
            {t("claim_success_title")}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {t("claim_success_desc")}
          </p>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t("your_claim_token")}
            </span>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span
                data-testid="claim-token-display"
                className="font-mono text-xl font-bold text-slate-900 dark:text-white"
              >
                {claimToken}
              </span>
              <button
                type="button"
                onClick={copyToClipboard}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                title={t("copy")}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            {copied && <p className="mt-1 text-xs text-emerald-600 font-semibold">{t("copied")}</p>}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            {t("claim_token_hint")}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/results"
              className="w-full sm:w-auto inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 font-bold text-white shadow hover:bg-emerald-700"
            >
              <span>{t("view_results")}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/document-plan"
              className="w-full sm:w-auto inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-2.5 font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {t("view_document_plan")}
            </Link>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t("save_claim_title")}
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                {t("save_claim_subtitle")}
              </p>
            </div>
            <AudioReadButton text={`${t("save_claim_title")}. ${declarationText}`} />
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mobile phone number input */}
          <div className="mt-6">
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">
              {t("mobile_number_label")}
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("mobile_number_help")}
            </p>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-slate-500">
                +91
              </span>
              <input
                type="tel"
                maxLength={10}
                data-testid="claim-phone-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="9876543210"
                className="min-h-[52px] w-full rounded-xl border border-slate-300 pl-12 pr-4 text-base font-semibold text-slate-900 tracking-wider focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>
          </div>

          {/* Consents */}
          <div className="mt-6 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t("consent_options")}
            </h3>

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={consentProcessing}
                onChange={(e) => setConsentProcessing(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                required
              />
              <span className="text-xs text-slate-700 dark:text-slate-300">
                <strong className="block font-semibold text-slate-900 dark:text-white">
                  {t("consent_data_processing")}
                </strong>
                {t("consent_data_processing_desc")}
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={consentSms}
                onChange={(e) => setConsentSms(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300">
                <strong className="block font-semibold text-slate-900 dark:text-white">
                  {t("consent_sms_reminders")}
                </strong>
                {t("consent_sms_reminders_desc")}
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={consentVolunteer}
                onChange={(e) => setConsentVolunteer(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300">
                <strong className="block font-semibold text-slate-900 dark:text-white">
                  {t("consent_volunteer_access")}
                </strong>
                {t("consent_volunteer_access_desc")}
              </span>
            </label>
          </div>

          {/* Declaration */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {t("declaration_title")}
            </h4>
            <p className="mt-2 text-xs italic text-slate-600 dark:text-slate-300 leading-relaxed">
              "{declarationText}"
            </p>
            <label className="mt-4 flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                data-testid="declaration-agree-checkbox"
                checked={declarationAgreed}
                onChange={(e) => setDeclarationAgreed(e.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                required
              />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {t("i_agree_declaration")}
              </span>
            </label>
          </div>

          {/* Submit */}
          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              data-testid="claim-submit-btn"
              disabled={isSubmitting || !declarationAgreed}
              className="inline-flex min-h-[52px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-600 px-8 py-3 font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {isSubmitting ? t("saving") : t("claim_and_save")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
