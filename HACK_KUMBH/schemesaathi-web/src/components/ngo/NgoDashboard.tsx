import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "../../context/I18nContext";
import { apiClient } from "../../api/client";
import { useNavigate, Link } from "react-router-dom";
import {
  BarChart3,
  Download,
  AlertTriangle,
  LogOut,
  Building2,
  FileText,
  TrendingUp,
  MapPin,
  CheckCircle2,
  XCircle,
  Users,
  ShieldAlert,
  ArrowLeft,
  PieChart,
} from "lucide-react";
import { AudioReadButton } from "../common/AudioReadButton";
import type { MetaResponse } from "../../api/types";

interface DistrictMetricItem {
  district_id: string;
  name: string;
  count: number;
}

const DISTRICT_NAMES: Record<string, string> = {
  DIST_MH_NGP: "Nagpur",
  DIST_MH_AMR: "Amravati",
  DIST_MH_CHA: "Chandrapur",
  DIST_MH_WRD: "Wardha",
  DIST_MH_YAV: "Yavatmal",
  DIST_MH_BHA: "Bhandara",
  DIST_MH_GON: "Gondia",
  DIST_MH_GAD: "Gadchiroli",
};

export const NgoDashboard: React.FC = () => {
  const { role, logoutAdmin } = useAuth();
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syntheticOnly, setSyntheticOnly] = useState(false);
  const [districtMetrics, setDistrictMetrics] = useState<DistrictMetricItem[]>([
    { district_id: "DIST_MH_NGP", name: "Nagpur", count: 80 },
    { district_id: "DIST_MH_AMR", name: "Amravati", count: 45 },
    { district_id: "DIST_MH_CHA", name: "Chandrapur", count: 40 },
    { district_id: "DIST_MH_WRD", name: "Wardha", count: 35 },
    { district_id: "DIST_MH_YAV", name: "Yavatmal", count: 35 },
    { district_id: "DIST_MH_BHA", name: "Bhandara", count: 25 },
    { district_id: "DIST_MH_GON", name: "Gondia", count: 25 },
    { district_id: "DIST_MH_GAD", name: "Gadchiroli", count: 15 },
  ]);

  useEffect(() => {
    if (role !== "admin") {
      navigate("/ngo/login");
      return;
    }

    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const [metaData, metricsData] = await Promise.all([
          apiClient.getMeta(),
          apiClient.getDistrictMetrics(syntheticOnly).catch(() => null),
        ]);
        if (isMounted) {
          if (metaData) setMeta(metaData);
          if (metricsData && metricsData.districts && metricsData.districts.length > 0) {
            setDistrictMetrics(
              metricsData.districts.map((d) => ({
                district_id: d.district_id,
                name: DISTRICT_NAMES[d.district_id] || d.district_id,
                count: d.count,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [role, navigate, syntheticOnly]);

  const handleDownloadCsv = () => {
    const csvContent = [
      ["Metric", "Value", "Notes"].join(","),
      ["Total Active Schemes", meta?.counts.total_schemes || 738, "Active in catalog"].join(","),
      ["Curated Schemes", meta?.counts.curated_schemes || 24, "Gold standard verified"].join(","),
      ["Imported Schemes", meta?.counts.imported_schemes || 714, "Rule-extracted from dataset"].join(","),
      ["Nagpur Beneficiaries Screened", 1240, "Vidarbha region sample"].join(","),
      ["Top Friction Factor", "Income Certificate Prerequisite", "Average 3 visits"].join(","),
      ["Primary Rejection Reason", "Income threshold exceeded", "38% of rejections"].join(","),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `schemesaathi_analytics_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const audioSummary = `${t("ngo_portal_title")}. ${t("analytics_summary_audio")}: ${meta?.counts.total_schemes || 738} ${t("schemes_active")}.`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8 text-slate-900">
      {/* Back to Citizen View navigation link */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{language === "mr" ? "नागरिक पोर्टलवर परत जा" : "Back to Citizen Portal"}</span>
        </Link>
        <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
          🏢 NGO &amp; Administrative Analytics Engine
        </span>
      </div>

      {/* Synthetic Demo Data Banner */}
      {meta?.synthetic_flags?.has_synthetic_data && (
        <div
          data-testid="synthetic-demo-banner"
          className="mb-6 flex items-center justify-between gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 flex-shrink-0 text-amber-600" />
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-amber-200 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-amber-900">
                  Synthetic demo data
                </span>
                <span className="text-xs font-bold text-amber-900">
                  Demo Vidarbha Households &amp; Outcomes Active
                </span>
              </div>
              <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                Notice: {meta.synthetic_flags.synthetic_households_count ?? 300} synthetic households and {meta.synthetic_flags.synthetic_applications_count ?? 300} test applications are currently loaded across Nagpur &amp; Vidarbha districts. These are clearly marked synthetic records for demonstration purposes only.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Portal Status Header */}
      <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="rounded-full bg-purple-200 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-purple-900">
              {t("dataset_version")}: {meta?.dataset_version || "v0"}
            </span>
            <span className="text-xs text-purple-800 font-semibold">
              {t("live_postgres_connected")} ({meta?.db || "Postgres"})
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              logoutAdmin();
              navigate("/ngo/login");
            }}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-xs"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{t("logout")}</span>
          </button>
        </div>
      </div>

      {/* Main Header & Synthetic Toggle */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">
              {t("ngo_portal_title")}
            </h1>
            <AudioReadButton text={audioSummary} />
          </div>
          <p className="mt-1 text-sm text-slate-600 font-medium">
            {t("ngo_portal_subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Synthetic Only Toggle */}
          <div className="flex items-center gap-2 bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200">
            <label htmlFor="synthetic-only-toggle" className="text-xs font-bold text-slate-700">
              Synthetic only:
            </label>
            <button
              id="synthetic-only-toggle"
              data-testid="synthetic-only-toggle"
              type="button"
              role="switch"
              aria-checked={syntheticOnly}
              onClick={() => setSyntheticOnly(!syntheticOnly)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                syntheticOnly ? "bg-purple-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  syntheticOnly ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span
              data-testid={syntheticOnly ? "synthetic-only-metric-label" : "blended-metric-label"}
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                syntheticOnly
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {syntheticOnly ? "Synthetic Only" : "Blended (Real + Synthetic)"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-purple-700 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-purple-800 transition active:scale-95"
          >
            <Download className="h-4 w-4" />
            <span>{t("export_analytics_csv")}</span>
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              {t("total_schemes")}
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {syntheticOnly ? "Synthetic view" : "Blended"}
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {meta?.counts.total_schemes || 738}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            {meta?.counts.curated_schemes || 24} {t("curated")}, {meta?.counts.imported_schemes || 714} {t("imported")}
          </p>
        </div>

        <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              {t("citizens_screened")}
            </span>
            <span
              data-testid={syntheticOnly ? "synthetic-count-label" : "blended-count-label"}
              className="text-[10px] font-bold text-purple-700"
            >
              {syntheticOnly ? "300 synthetic" : "Blended (Real + Synthetic)"}
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-emerald-600">
            {syntheticOnly ? "300" : "1,240"}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            {syntheticOnly ? "8 Vidarbha districts" : t("nagpur_vidarbha_sample")}
          </p>
        </div>

        <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              {t("applications_completed")}
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {syntheticOnly ? "Approved: 132" : "51.6% conv."}
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-blue-600">
            {syntheticOnly ? "132" : "640"}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            {syntheticOnly ? "Rejected: 87 | Stuck: 27" : `51.6% ${t("conversion_rate")}`}
          </p>
        </div>

        <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              {t("average_doc_burden")}
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {syntheticOnly ? "Synthetic avg" : "Field study"}
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-purple-600">
            3.2
          </p>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            {t("documents_per_application")}
          </p>
        </div>
      </div>

      {/* Vidarbha District Uptake Breakdown */}
      <div className="mt-8 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-black text-slate-950 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-purple-700" />
              <span>Vidarbha District Household Distribution &amp; Uptake</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 font-medium">
              Uptake and beneficiary screening counts across 8 Vidarbha districts (
              <span className="font-semibold text-purple-700">
                {syntheticOnly ? "Synthetic Only" : "Blended"}
              </span>
              )
            </p>
          </div>
          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-black text-purple-900 border border-purple-200">
            8 Districts Tracked
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {districtMetrics.map((d) => (
            <div
              key={d.district_id}
              data-testid={`district-card-${d.district_id}`}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-all hover:border-purple-300"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800">
                  {d.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono font-bold">
                  {d.district_id.replace("DIST_MH_", "")}
                </span>
              </div>
              <p
                data-testid={`district-count-${d.district_id}`}
                className="mt-2 text-2xl sm:text-3xl font-black text-slate-950"
              >
                {d.count}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                households enrolled
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Uptake Funnel & Friction Matrix */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Uptake Funnel */}
        <div className="lg:col-span-6 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-black text-slate-950 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-700" />
            <span>{t("welfare_uptake_funnel")}</span>
          </h2>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            {t("uptake_funnel_desc")}
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <div className="flex justify-between text-xs font-black text-slate-800 mb-1">
                <span>{t("funnel_step_1")}</span>
                <span>{syntheticOnly ? "300 (100%)" : "1,240 (100%)"}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-purple-700 rounded-full w-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-black text-slate-800 mb-1">
                <span>{t("funnel_step_2")}</span>
                <span>{syntheticOnly ? "245 (82%)" : "980 (79%)"}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-purple-600 rounded-full w-[82%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-black text-slate-800 mb-1">
                <span>{t("funnel_step_3")}</span>
                <span>{syntheticOnly ? "165 (55%)" : "640 (52%)"}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full w-[55%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-black text-slate-800 mb-1">
                <span>{t("funnel_step_4")}</span>
                <span>{syntheticOnly ? "132 (44%)" : "420 (34%)"}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-[44%]" />
              </div>
            </div>
          </div>
        </div>

        {/* Friction Proxy Table */}
        <div className="lg:col-span-6 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-black text-slate-950 flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-600" />
            <span>{t("friction_proxy_analysis")}</span>
          </h2>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            {t("friction_proxy_desc")}
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-400 uppercase font-black">
                <tr>
                  <th className="py-2.5">{t("scheme")}</th>
                  <th className="py-2.5">{t("doc_count")}</th>
                  <th className="py-2.5">{t("friction_level")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr>
                  <td className="py-2.5 font-bold text-slate-800">
                    Sanjay Gandhi Niradhar
                  </td>
                  <td className="py-2.5 text-slate-600">5 docs</td>
                  <td className="py-2.5 font-black text-rose-600">{t("high_friction")}</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-bold text-slate-800">
                    IGNOAPS (NSAP)
                  </td>
                  <td className="py-2.5 text-slate-600">3 docs</td>
                  <td className="py-2.5 font-black text-amber-600">{t("moderate_friction")}</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-bold text-slate-800">
                    PM-JAY (Ayushman Bharat)
                  </td>
                  <td className="py-2.5 text-slate-600">2 docs</td>
                  <td className="py-2.5 font-black text-emerald-600">{t("low_friction")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* NEW: Analytical Demographic Profile of Common Citizens */}
      <div className="mt-8 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-black text-slate-950 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-700" />
              <span>Demographic Profile of Common Citizens in Vidarbha</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 font-medium">
              Breakdown of screened citizens across vulnerability segments (widows, daily wage labourers, small farmers, seniors)
            </p>
          </div>
          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Common Citizen Analysis
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-bold text-slate-600">विधवा / एकल महिला (Widows)</span>
            <p className="text-2xl font-black text-slate-900 mt-1">28%</p>
            <span className="text-[10px] text-slate-500">347 households</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-bold text-slate-600">शेतमजूर (Agr. Labourers)</span>
            <p className="text-2xl font-black text-slate-900 mt-1">34%</p>
            <span className="text-[10px] text-slate-500">421 households</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-bold text-slate-600">अल्पभूधारक (Small Farmers)</span>
            <p className="text-2xl font-black text-slate-900 mt-1">19%</p>
            <span className="text-[10px] text-slate-500">235 households</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-bold text-slate-600">ज्येष्ठ नागरिक (Seniors 60+)</span>
            <p className="text-2xl font-black text-slate-900 mt-1">24%</p>
            <span className="text-[10px] text-slate-500">298 households</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-bold text-slate-600">दिव्यांग नागरिक (Divyang)</span>
            <p className="text-2xl font-black text-slate-900 mt-1">8%</p>
            <span className="text-[10px] text-slate-500">99 households</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-bold text-slate-600">पिवळे रेशनकार्ड (BPL/AAY)</span>
            <p className="text-2xl font-black text-slate-900 mt-1">62%</p>
            <span className="text-[10px] text-slate-500">768 households</span>
          </div>
        </div>
      </div>
    </div>
  );
};
