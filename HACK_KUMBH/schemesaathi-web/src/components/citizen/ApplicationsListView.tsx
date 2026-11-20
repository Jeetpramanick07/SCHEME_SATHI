import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "../../context/I18nContext";
import { useHousehold } from "../../context/HouseholdContext";
import { AudioReadButton } from "../common/AudioReadButton";
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  PlusCircle,
  AlertTriangle,
  Building2,
  Calendar,
  Hash,
} from "lucide-react";
import type { Application } from "../../api/types";

const STUCK_THRESHOLD_DAYS = 7;

export const ApplicationsListView: React.FC = () => {
  const { t, language } = useTranslation();
  const { householdId } = useHousehold();
  const navigate = useNavigate();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage or initialize with demo records
    try {
      const saved = localStorage.getItem("schemesaathi_applications");
      if (saved) {
        setApplications(JSON.parse(saved));
      } else {
        // Default initial applications for demo / testing
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

        const initialApps: Application[] = [
          {
            application_id: "app_nsap_widow_demo",
            household_id: householdId || "hh_demo",
            scheme_id: "CENT-MORD-NSAP-006",
            scheme_name:
              language === "mr"
                ? "राष्ट्रीय सामाजिक सहाय्य कार्यक्रम (NSAP - इंदिरा गांधी विधवा निवृत्तीवेतन)"
                : "National Social Assistance Programme (NSAP - Indira Gandhi Widow Pension)",
            status: "draft",
            applied_at: tenDaysAgo,
            reference_number: "",
            updated_at: tenDaysAgo, // 10 days ago -> triggers stuck nudge!
            steps: [
              {
                step_number: 1,
                title: "Gather Required Documents",
                description: "Yellow ration card, death certificate of spouse, age proof",
                is_completed: false,
              },
              {
                step_number: 2,
                title: "Fill Application Form",
                description: "Tehsildar office form submission",
                is_completed: false,
              },
              {
                step_number: 3,
                title: "Verification by Talathi",
                description: "Ground inspection",
                is_completed: false,
              },
            ],
          },
          {
            application_id: "app_sanjay_gandhi_demo",
            household_id: householdId || "hh_demo",
            scheme_id: "MH-SJSA-SANJAYGANDHI-014",
            scheme_name:
              language === "mr"
                ? "संजय गांधी निराधार अनुदान योजना"
                : "Sanjay Gandhi Niradhar Anudan Yojana",
            status: "submitted",
            applied_at: twoDaysAgo,
            reference_number: "MH/2026/SGN/94821",
            updated_at: twoDaysAgo,
            steps: [
              {
                step_number: 1,
                title: "Gather Required Documents",
                description: "Documents gathered",
                is_completed: true,
              },
              {
                step_number: 2,
                title: "Application Submitted to Setu Kendra",
                description: "Acknowledgement slip generated",
                is_completed: true,
              },
              {
                step_number: 3,
                title: "Sanction Committee Approval",
                description: "Under committee review",
                is_completed: false,
              },
            ],
          },
        ];
        localStorage.setItem("schemesaathi_applications", JSON.stringify(initialApps));
        setApplications(initialApps);
      }
    } catch {
      // quota or local storage unavailable
    } finally {
      setLoading(false);
    }
  }, [householdId, language]);

  const getStatusChip = (status: Application["status"]) => {
    switch (status) {
      case "approved":
        return {
          bg: "bg-emerald-100 text-emerald-800 border-emerald-300",
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
          label: t("status_approved") || "Approved",
        };
      case "submitted":
        return {
          bg: "bg-blue-100 text-blue-800 border-blue-300",
          icon: <Clock className="h-3.5 w-3.5" />,
          label: t("status_submitted") || "Submitted",
        };
      case "under_review":
        return {
          bg: "bg-purple-100 text-purple-800 border-purple-300",
          icon: <HelpCircle className="h-3.5 w-3.5" />,
          label: t("status_under_review") || "Under Review",
        };
      case "rejected":
        return {
          bg: "bg-rose-100 text-rose-800 border-rose-300",
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          label: t("status_rejected") || "Rejected",
        };
      case "draft":
      default:
        return {
          bg: "bg-amber-100 text-amber-800 border-amber-300",
          icon: <FileText className="h-3.5 w-3.5" />,
          label: t("status_draft") || "Draft",
        };
    }
  };

  const calculateDaysPending = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  const audioSummary = `${t("my_applications_title") || "My Applications"}. Total active applications: ${applications.length}.`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-[#2D231E] tracking-tight sm:text-3xl">
              {language === "mr" ? "माझे अर्ज (My Applications)" : language === "hi" ? "मेरे आवेदन (My Applications)" : "My Applications"}
            </h1>
            <AudioReadButton text={audioSummary} />
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            {t("my_applications_subtitle") || "Track your scheme application progress, references, and pending steps."}
          </p>
        </div>

        <Link
          to="/results"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-blue-800 transition"
        >
          <PlusCircle className="h-4 w-4" />
          <span>{t("find_more_schemes") || "Find Schemes"}</span>
        </Link>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm font-bold text-slate-500">
          {t("loading") || "Loading applications..."}
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-12 text-center space-y-4">
          <FileText className="h-12 w-12 text-slate-400 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">
            {t("no_applications_yet") || "No Applications Started Yet"}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            {t("no_applications_desc") || "Start an application directly from your eligible scheme results to track documents and government submission status."}
          </p>
          <Link
            to="/results"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
          >
            <span>{t("view_eligible_schemes") || "View Eligible Schemes"}</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const chip = getStatusChip(app.status);
            const daysPending = calculateDaysPending(app.updated_at || app.applied_at || new Date().toISOString());
            const isStuck = (app.status === "draft" || app.status === "submitted") && daysPending >= STUCK_THRESHOLD_DAYS;

            return (
              <div
                key={app.application_id}
                className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-xs hover:border-blue-400 transition space-y-4"
              >
                {/* Header: Title and Status Chip */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-bold text-slate-700">
                        {app.scheme_id}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${chip.bg}`}
                      >
                        {chip.icon}
                        {chip.label}
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {app.scheme_name}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/applications/${app.application_id}?tab=guide`}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E8DFD5] bg-white px-3 py-1.5 text-xs font-bold text-[#2D231E] hover:bg-[#FAF7F2] transition"
                      title="View step-by-step application guide"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#C4714A]" />
                      <span>{language === "mr" ? "मार्गदर्शक" : "Guide"}</span>
                    </Link>
                    <Link
                      to={`/applications/${app.application_id}?tab=track`}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#4F7B55] hover:bg-[#3F6444] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition"
                      title="Track live application progress"
                    >
                      <span>{language === "mr" ? "मागोवा घ्या (Track)" : "Track Now"}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>

                {/* Stuck Nudge Banner */}
                {isStuck && (
                  <div
                    role="alert"
                    data-testid="stuck-nudge"
                    className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 flex items-start gap-2.5 animate-in fade-in"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <strong className="block font-bold uppercase tracking-wider text-amber-900">
                        अडकले आहात का? (Stuck? Documents pending for {daysPending} days)
                      </strong>
                      <p className="mt-0.5 text-amber-800">
                        कागदपत्रे मिळवण्यात किंवा अर्ज भरण्यात अडचण येत असल्यास, जवळच्या केंद्र किंवा स्वयंसेवकाची मदत घ्या.
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <Link
                          to={`/help-centres?schemeId=${app.scheme_id}`}
                          className="inline-flex items-center gap-1 font-bold text-blue-800 underline hover:text-blue-950"
                        >
                          <Building2 className="h-3 w-3" />
                          <span>{t("find_help_centre") || "Find Nearby Help Centre"}</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* Metadata Details Bar */}
                <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-medium text-slate-700">
                      {app.reference_number ? (
                        <span className="font-mono font-bold text-blue-900">{app.reference_number}</span>
                      ) : (
                        <span className="italic text-slate-400">{t("no_reference_yet") || "No reference number yet (Draft)"}</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {t("last_updated") || "Last updated"}: {new Date(app.updated_at || Date.now()).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {app.steps?.filter((s) => s.is_completed).length || 0} of {app.steps?.length || 4} {t("steps_completed") || "steps completed"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};