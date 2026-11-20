import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "../../context/I18nContext";
import { useNavigate, Link } from "react-router-dom";
import { KeyRound, ShieldAlert, ArrowRight, BarChart3, Sparkles, ArrowLeft, Building2 } from "lucide-react";
import { AudioReadButton } from "../common/AudioReadButton";

export const NgoLogin: React.FC = () => {
  const { setAdminKey } = useAuth();
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  const [inputKey, setInputKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setError(t("admin_key_required"));
      return;
    }
    // Set in sessionStorage only
    setAdminKey(inputKey.trim());
    navigate("/ngo");
  };

  const handle1ClickDemo = () => {
    setAdminKey("admin-secret-key");
    navigate("/ngo");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:py-12 text-slate-900">
      <div className="mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{language === "mr" ? "मुख्य पृष्ठावर परत जा" : "Back to Home"}</span>
        </Link>
      </div>

      <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 shadow-sm">
            <BarChart3 className="h-6 w-6" />
          </div>
          <AudioReadButton text={`${t("ngo_login_title")}. ${t("ngo_login_desc")}`} />
        </div>

        <h1 className="mt-4 text-2xl font-black text-slate-950">
          {t("ngo_login_title")}
        </h1>
        <p className="mt-1 text-xs text-slate-600 font-medium leading-relaxed">
          {language === "mr"
            ? "सामाजिक संस्था व प्रशासकीय विश्लेषकांसाठी विदर्भातील नागरिकांचे अर्ज व योजना प्रगतीचे विश्लेषणात्मक पोर्टल."
            : t("ngo_login_desc")}
        </p>

        {/* 1-Click NGO Demo Access Button */}
        <div className="mt-5 p-4 rounded-2xl bg-purple-50 border-2 border-purple-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-purple-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{language === "mr" ? "त्वरित चाचणी डेमो प्रवेश" : "Instant Demo Analyst Access"}</span>
            </span>
            <span className="text-[10px] font-bold bg-purple-200 text-purple-900 px-2 py-0.5 rounded-full">
              Demo
            </span>
          </div>
          <p className="text-[11px] text-purple-800 leading-normal">
            {language === "mr"
              ? "कोणतीही की न टाकता एका क्लिकवर विदर्भातील सर्व ८ जिल्ह्यांचे नागरिक विश्लेषण डॅशबोर्ड पहा."
              : "Access the full 8-district citizen analytics dashboard immediately in 1 click."}
          </p>
          <button
            type="button"
            data-testid="demo-ngo-login-btn"
            onClick={handle1ClickDemo}
            className="w-full min-h-[42px] py-2 px-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-95"
          >
            <span>{language === "mr" ? "⚡ १-क्लिक NGO डेमो डॅशबोर्ड उघडा" : "⚡ 1-Click Demo NGO Dashboard"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
          <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
          <span>{t("runtime_key_notice")}</span>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-black uppercase text-slate-700 mb-1">
              {t("admin_api_key")}
            </label>
            <div className="relative mt-1">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="admin-secret-key"
                className="min-h-[48px] w-full rounded-xl border-2 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 pl-10 pr-4 text-sm font-mono focus:bg-white focus:text-slate-950 focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 shadow-sm transition-all"
                required
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">
              {t("never_persisted_to_disk")}
            </p>
          </div>

          <button
            type="submit"
            className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-purple-700 px-6 py-3 font-black text-sm text-white shadow-md hover:bg-purple-800 transition active:scale-95"
          >
            <span>{t("login_as_analyst")}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
