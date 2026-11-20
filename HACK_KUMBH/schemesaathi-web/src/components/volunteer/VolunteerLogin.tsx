import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "../../context/I18nContext";
import { useNavigate } from "react-router-dom";
import { KeyRound, ShieldAlert, ArrowRight, UserCheck } from "lucide-react";
import { AudioReadButton } from "../common/AudioReadButton";

export const VolunteerLogin: React.FC = () => {
  const { setVolunteerKey, role } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [inputKey, setInputKey] = useState("");
  const [assistedBy, setAssistedBy] = useState("field-worker-01");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setError(t("volunteer_key_required"));
      return;
    }
    // Set in sessionStorage only
    setVolunteerKey(inputKey.trim(), assistedBy.trim());
    navigate("/volunteer");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <UserCheck className="h-6 w-6" />
          </div>
          <AudioReadButton text={`${t("volunteer_login_title")}. ${t("volunteer_login_desc")}`} />
        </div>

        <h1 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">
          {t("volunteer_login_title")}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {t("volunteer_login_desc")}
        </p>

        {/* Security Notice */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{t("runtime_key_notice")}</span>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500">
              {t("volunteer_api_key")}
            </label>
            <div className="relative mt-1">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="volunteer-secret-key"
                className="min-h-[48px] w-full rounded-xl border border-slate-300 pl-10 pr-4 text-sm font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {t("never_persisted_to_disk")}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500">
              {t("volunteer_name_or_id")}
            </label>
            <input
              type="text"
              value={assistedBy}
              onChange={(e) => setAssistedBy(e.target.value)}
              placeholder="e.g. vidarbha-seva-04"
              className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              required
            />
          </div>

          <button
            type="submit"
            className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white shadow hover:bg-emerald-700 transition"
          >
            <span>{t("login_as_volunteer")}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
