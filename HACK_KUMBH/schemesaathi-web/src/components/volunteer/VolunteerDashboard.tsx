import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useHousehold } from "../../context/HouseholdContext";
import { useTranslation } from "../../context/I18nContext";
import { offlineStorage } from "../../lib/offline-storage";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  UserPlus,
  FileText,
  CheckCircle,
  LogOut,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Smartphone,
  Layers,
} from "lucide-react";
import { AudioReadButton } from "../common/AudioReadButton";

export const VolunteerDashboard: React.FC = () => {
  const { role, assistedBy, logout } = useAuth();
  const { householdId, resetHousehold, evaluation, answers } = useHousehold();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [offlineCount, setOfflineCount] = useState(offlineStorage.getQueue().length);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (role !== "volunteer" && role !== "admin") {
      navigate("/volunteer/login");
    }
  }, [role, navigate]);

  const handleCreateNewCitizen = () => {
    resetHousehold();
    navigate("/questionnaire");
  };

  const handleSyncOffline = async () => {
    setIsSyncing(true);
    await offlineStorage.flushQueue();
    setOfflineCount(offlineStorage.getQueue().length);
    setIsSyncing(false);
  };

  const answeredCount = Object.keys(answers).length;
  const eligibleCount = evaluation?.results?.[0]?.tiers?.can_apply?.length || 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Volunteer Assisted Mode Top Banner */}
      <div className="rounded-2xl border border-emerald-400 bg-emerald-500/10 p-4 dark:border-emerald-700 dark:bg-emerald-950/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                {t("assisted_mode_active")}
              </p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t("volunteer_id")}: <span className="font-mono">{assistedBy || "field-worker"}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/volunteer/login");
            }}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("logout")}
          </button>
        </div>
      </div>

      {/* Main Header */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-6 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
              {t("volunteer_portal_title")}
            </h1>
            <AudioReadButton text={`${t("volunteer_portal_title")}. ${t("volunteer_portal_subtitle")}`} />
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t("volunteer_portal_subtitle")}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateNewCitizen}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-700 transition"
        >
          <UserPlus className="h-4 w-4" />
          {t("new_citizen_screening")}
        </button>
      </div>

      {/* Active Household Card */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <span className="text-xs font-bold uppercase text-slate-400">
              {t("active_household_session")}
            </span>
            <p className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-white">
              {householdId}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {answeredCount} {t("answers_recorded")}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <span className="text-xs text-slate-500 font-semibold">{t("eligible_schemes")}</span>
            <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {eligibleCount}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <span className="text-xs text-slate-500 font-semibold">{t("answered_questions")}</span>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
              {answeredCount}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <span className="text-xs text-slate-500 font-semibold">{t("offline_queue")}</span>
            <p className="mt-1 text-2xl font-black text-amber-600">
              {offlineCount}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/questionnaire"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <Layers className="h-4 w-4" />
            {t("continue_questionnaire")}
          </Link>
          <Link
            to="/results"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <CheckCircle className="h-4 w-4" />
            {t("view_scheme_results")}
          </Link>
          <Link
            to="/document-plan"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <FileText className="h-4 w-4" />
            {t("document_plan")}
          </Link>
        </div>
      </div>

      {/* Offline Storage Sync Section */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-emerald-600" />
              {t("offline_sync_manager")}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {t("offline_sync_desc")}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSyncOffline}
            disabled={isSyncing || offlineCount === 0}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? t("syncing") : `${t("flush_queue")} (${offlineCount})`}
          </button>
        </div>
      </div>
    </div>
  );
};
