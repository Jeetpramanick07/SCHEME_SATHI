import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "../../context/I18nContext";
import { useHousehold } from "../../context/HouseholdContext";
import { apiClient } from "../../api/client";
import { AudioReadButton } from "../common/AudioReadButton";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  FileCheck,
  ChevronRight,
  ShieldAlert,
  ArrowLeft,
  ExternalLink,
  Globe,
  FileText,
  Save,
  CheckCircle2,
  Building2,
  Share2,
  Copy,
  Check,
  Bell,
  RefreshCw,
  MapPin,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { Application } from "../../api/types";

const getSchemePortal = (schemeId: string): { name: string; url: string } => {
  const upper = schemeId.toUpperCase();
  if (upper.includes("PMJAY") || upper.includes("MOHFW-PMJAY")) {
    return {
      name: "National Health Authority PM-JAY Beneficiary Portal",
      url: "https://beneficiary.nha.gov.in/",
    };
  }
  if (upper.includes("MJPJAY")) {
    return {
      name: "Mahatma Jyotirao Phule Jan Arogya Portal",
      url: "https://www.jeevandayee.gov.in/",
    };
  }
  if (upper.includes("NSAP")) {
    return {
      name: "National Social Assistance Programme (NSAP) Portal",
      url: "https://nsap.nic.in/",
    };
  }
  if (upper.includes("SANJAYGANDHI") || upper.includes("SHRAVANBAL") || upper.includes("AAPLE")) {
    return {
      name: "आपले सरकार महाराष्ट्र पोर्टल (Aaple Sarkar)",
      url: "https://aaplesarkar.mahaonline.gov.in/",
    };
  }
  if (upper.includes("PMKISAN")) {
    return {
      name: "PM-Kisan Samman Nidhi Portal",
      url: "https://pmkisan.gov.in/",
    };
  }
  return {
    name: "Government Welfare Portal",
    url: "https://aaplesarkar.mahaonline.gov.in/",
  };
};

export const ApplicationStepper: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "track" ? "track" : "guide";

  const { householdId } = useHousehold();
  const { t, language } = useTranslation();

  const [activeTab, setActiveTab] = useState<"guide" | "track">(initialTab);
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [refNumber, setRefNumber] = useState("");
  const [isEditingRef, setIsEditingRef] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [latestSms, setLatestSms] = useState<string | null>(null);

  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl === "track" || tabFromUrl === "guide") {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const switchTab = (tab: "guide" | "track") => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    let isMounted = true;
    async function loadApp() {
      if (!id) return;
      try {
        setLoading(true);
        const savedAppsStr = localStorage.getItem("schemesaathi_applications");
        if (savedAppsStr) {
          const apps: Application[] = JSON.parse(savedAppsStr);
          const localMatch = apps.find((a) => a.application_id === id || a.scheme_id === id);
          if (localMatch && isMounted) {
            setApplication(localMatch);
            setRefNumber(localMatch.reference_number || "MH-2026-NSAP-849204");
            setLoading(false);
            return;
          }
        }

        const data = await apiClient.getApplication(id);
        if (isMounted) {
          setApplication(data);
          setRefNumber(data.reference_number || "MH-2026-NSAP-849204");
        }
      } catch {
        if (isMounted) {
          const fallbackApp: Application = {
            application_id: id || "app_nsap_widow_demo",
            household_id: householdId || "hh_demo",
            scheme_id: id || "CENT-MORD-NSAP-006",
            scheme_name:
              language === "mr"
                ? "राष्ट्रीय सामाजिक सहाय्य कार्यक्रम (NSAP - इंदिरा गांधी विधवा निवृत्तीवेतन)"
                : language === "hi"
                ? "राष्ट्रीय सामाजिक सहायता कार्यक्रम (NSAP - इंदिरा गांधी विधवा पेंशन)"
                : "National Social Assistance Programme (NSAP - Indira Gandhi Widow Pension)",
            status: "under_review",
            applied_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            reference_number: "MH-2026-NSAP-849204",
            steps: [
              {
                step_number: 1,
                title: "Visit Official Portal",
                description: "Visit official government scheme portal",
                is_completed: true,
              },
              {
                step_number: 2,
                title: "Login or Register with Aadhaar",
                description: "Use your Aadhaar-linked mobile for OTP verification",
                is_completed: true,
              },
              {
                step_number: 3,
                title: "Fill Application Form and Upload Documents",
                description: "Enter required details and upload verified certificates",
                is_completed: true,
              },
              {
                step_number: 4,
                title: "Submit Application",
                description: "Download acknowledgement receipt and note application reference",
                is_completed: false,
              },
            ],
            updated_at: new Date().toISOString(),
          };
          setApplication(fallbackApp);
          setRefNumber("MH-2026-NSAP-849204");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadApp();
    return () => {
      isMounted = false;
    };
  }, [id, householdId, language]);

  const handleCopyRef = () => {
    if (refNumber) {
      navigator.clipboard.writeText(refNumber);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const handleSaveRef = () => {
    if (!application) return;
    try {
      const savedAppsStr = localStorage.getItem("schemesaathi_applications");
      const apps: Application[] = savedAppsStr ? JSON.parse(savedAppsStr) : [];
      const updated = apps.map((a) =>
        a.application_id === application.application_id ? { ...a, reference_number: refNumber } : a
      );
      localStorage.setItem("schemesaathi_applications", JSON.stringify(updated));
      setApplication({ ...application, reference_number: refNumber });
      setIsEditingRef(false);
      setSaveFeedback(language === "mr" ? "संदर्भ क्रमांक जतन केला!" : "Reference Number saved!");
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch {}
  };

  const handleAdvanceStatus = () => {
    if (!application) return;
    const stages: Array<Application["status"]> = ["draft", "submitted", "under_review", "approved"];
    const currentIndex = stages.indexOf(application.status);
    const nextIndex = (currentIndex + 1) % stages.length;
    const newStatus = stages[nextIndex];

    const updatedApp: Application = {
      ...application,
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    setApplication(updatedApp);

    try {
      const savedAppsStr = localStorage.getItem("schemesaathi_applications");
      const apps: Application[] = savedAppsStr ? JSON.parse(savedAppsStr) : [];
      const updated = apps.map((a) =>
        a.application_id === application.application_id ? updatedApp : a
      );
      localStorage.setItem("schemesaathi_applications", JSON.stringify(updated));

      // Trigger simulated SMS notification
      const smsText =
        newStatus === "approved"
          ? `प्रिय नागरिक, आपला अर्ज (${refNumber}) मंजूर झाला आहे! पहिला हप्ता थेट बँक खात्यात वर्ग केला जाईल.`
          : newStatus === "under_review"
          ? `प्रिय नागरिक, आपला अर्ज (${refNumber}) तालुका मंजुरी समितीकडे छाननीसाठी पुढे सरकला आहे.`
          : `प्रिय नागरिक, आपला अर्ज (${refNumber}) सेतू केंद्रावर यशस्वीरीत्या नोंदवला गेला आहे.`;

      setLatestSms(smsText);

      // Save to simulated inbox
      const savedSms = localStorage.getItem("schemesaathi_simulated_sms");
      const list = savedSms ? JSON.parse(savedSms) : [];
      list.unshift({
        id: `sms_${Date.now()}`,
        recipient: "+91 98231 45890",
        message: smsText,
        timestamp: new Date().toISOString(),
        scheme_id: application.scheme_id,
        status: "DELIVERED",
      });
      localStorage.setItem("schemesaathi_simulated_sms", JSON.stringify(list));
    } catch {}
  };

  const portal = getSchemePortal(application?.scheme_id || id || "");

  const guideSteps = [
    {
      num: 1,
      title: language === "mr" ? "अधिकृत पोर्टलला भेट द्या" : "Visit Official Portal",
      url: portal.url,
      desc: language === "mr" ? "ब्राउझरमध्ये अधिकृत शासकीय पोर्टल उघडा" : "Open government portal in browser",
    },
    {
      num: 2,
      title: language === "mr" ? "आधारने लॉगिन किंवा नोंदणी करा" : "Login or Register with Aadhaar",
      url: null,
      desc: language === "mr" ? "आधार नोंदणीकृत मोबाईलवर OTP द्वारे पडताळणी करा" : "Authenticate using Aadhaar OTP or mobile verification",
    },
    {
      num: 3,
      title: language === "mr" ? "अर्जात माहिती भरा व कागदपत्रे जोडा" : "Fill Application Form and Upload Documents",
      url: null,
      desc: language === "mr" ? "उत्पन्न दाखला, रेशन कार्ड आणि बँक पासबुक जोडा" : "Attach Income certificate, Ration card, and Passbook copies",
    },
    {
      num: 4,
      title: language === "mr" ? "अर्ज सादर करा व पोच पावती घ्या" : "Submit Application",
      url: null,
      desc: language === "mr" ? "SMS द्वारे पोच पावती आणि अर्ज संदर्भ क्रमांक मिळवा" : "Receive SMS confirmation and reference application number",
    },
  ];

  const getStatusBadge = (status: Application["status"]) => {
    switch (status) {
      case "approved":
        return {
          bg: "bg-[#EBF2EC] text-[#4F7B55] border-[#CADBCB]",
          label: language === "mr" ? "मंजूर (Approved)" : language === "hi" ? "स्वीकृत (Approved)" : "Approved",
          stepNumber: 4,
        };
      case "under_review":
        return {
          bg: "bg-[#FDF4E7] text-[#C4714A] border-[#F4DEC3]",
          label: language === "mr" ? "छाननी सुरू (Under Review)" : language === "hi" ? "समीक्षा जारी (Under Review)" : "Under Review",
          stepNumber: 3,
        };
      case "submitted":
        return {
          bg: "bg-blue-50 text-blue-800 border-blue-200",
          label: language === "mr" ? "सादर केला (Submitted)" : language === "hi" ? "जमा किया (Submitted)" : "Submitted",
          stepNumber: 2,
        };
      case "draft":
      default:
        return {
          bg: "bg-[#FAF7F2] text-[#6B5E55] border-[#E8DFD5]",
          label: language === "mr" ? "कागदपत्रे प्रलंबित (Draft)" : language === "hi" ? "प्रारूप (Draft)" : "Draft",
          stepNumber: 1,
        };
    }
  };

  const statusBadge = getStatusBadge(application?.status || "under_review");

  return (
    <div className="mx-auto max-w-2xl px-2 sm:px-4 py-4 text-[#2D231E]">
      {/* Top Header with Back Button & Share */}
      <div className="flex items-center justify-between border-b border-[#E8DFD5] pb-4 mb-4">
        <div className="flex items-center gap-3">
          <Link
            to="/applications"
            className="p-1.5 rounded-full hover:bg-white text-[#6B5E55] transition-colors"
            title="माझे अर्ज यादीत परत जा"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#2D231E] tracking-tight">
              {activeTab === "guide"
                ? language === "mr" ? "अर्ज मार्गदर्शक (Guide)" : "Application Guide"
                : language === "mr" ? "थेट स्थिती ट्रॅकिंग (Live Tracker)" : "Application Live Status Tracker"}
            </h1>
            <p className="text-xs text-[#6B5E55] font-semibold truncate max-w-[280px] sm:max-w-md">
              {application?.scheme_name || "Official Scheme Procedure"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: application?.scheme_name, url: window.location.href });
            }
          }}
          className="p-2 rounded-xl text-[#6B5E55] hover:text-[#2D231E] hover:bg-white flex-shrink-0"
          title="Share Guide"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Switcher Tabs: Guide vs Live Status Tracker */}
      <div className="flex items-center gap-2 p-1 bg-[#EBE2D8] rounded-2xl border border-[#DECFC0] mb-5">
        <button
          type="button"
          onClick={() => switchTab("guide")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === "guide"
              ? "bg-[#C4714A] text-white shadow-xs"
              : "text-[#6B5E55] hover:text-[#2D231E]"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{language === "mr" ? "१. अर्ज कसा करावा (Guide)" : "1. Application Guide"}</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab("track")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === "track"
              ? "bg-[#4F7B55] text-white shadow-xs"
              : "text-[#6B5E55] hover:text-[#2D231E]"
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>{language === "mr" ? "२. थेट मागोवा (Live Tracker)" : "2. Live Tracker"}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: APPLICATION GUIDE (Matching 6_Application_Guide.png)               */}
      {/* ========================================================================= */}
      {activeTab === "guide" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Vertical Step Timeline */}
          <div className="bg-white rounded-3xl border border-[#E8DFD5] p-6 shadow-xs relative">
            <div className="relative pl-6 sm:pl-8 space-y-8">
              {/* Vertical Green Connecting Line */}
              <div className="absolute left-10 sm:left-12 top-6 bottom-6 w-0.5 bg-[#4F7B55]" />

              {guideSteps.map((step) => (
                <div key={step.num} className="relative flex items-start gap-4 z-10">
                  <div className="w-9 h-9 rounded-full bg-[#4F7B55] text-white flex items-center justify-center font-black text-sm shadow-sm flex-shrink-0 border-2 border-white">
                    {step.num}
                  </div>

                  <div className="flex-1 pt-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm sm:text-base font-black text-[#2D231E]">
                        {step.title}
                      </h3>
                      {step.url && (
                        <a
                          href={step.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#4F7B55] hover:text-[#3F6444] p-1 flex-shrink-0"
                          title="Open Official Portal"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    {step.url && (
                      <a
                        href={step.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-[#4F7B55] hover:underline block mt-0.5 break-all"
                      >
                        {step.url}
                      </a>
                    )}
                    <p className="text-xs text-[#6B5E55] mt-1 font-medium">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 6_Application_Guide.png: Track Your Application Card */}
          <div className="rounded-3xl bg-[#EBF2EC] border border-[#CADBCB] p-5 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#4F7B55] text-white flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-[#2D231E]">
                  {language === "mr" ? "आपल्या अर्जाची सद्यस्थिती तपासा" : "Track Your Application"}
                </h4>
                <p className="text-xs text-[#4F7B55] font-medium mt-0.5">
                  {language === "mr"
                    ? "प्रत्यक्ष स्थिती, मंजुरी टप्पे आणि SMS सूचनांचा मागोवा घ्या"
                    : "Check real-time status & get simulated SMS updates"}
                </p>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => switchTab("track")}
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-white text-[#4F7B55] border-2 border-[#4F7B55] hover:bg-[#FAF7F2] font-black text-xs shadow-xs transition-transform active:scale-95 cursor-pointer"
                  >
                    <span>{language === "mr" ? "स्थिती ट्रॅक करा (Track Now) →" : "Track Now →"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DEDICATED APPLICATION TRACKING PAGE (Live Status Tracker)         */}
      {/* ========================================================================= */}
      {activeTab === "track" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Main Status & Reference Card */}
          <div className="bg-white rounded-3xl border border-[#E8DFD5] p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-[#6B5E55] uppercase tracking-wider block">
                  {language === "mr" ? "अर्जाची सद्यस्थिती" : "Current Status"}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border ${statusBadge.bg}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    {statusBadge.label}
                  </span>
                  <span className="text-xs text-[#6B5E55] font-semibold">
                    {language === "mr" ? "अद्यतनित: आज" : "Updated: Today"}
                  </span>
                </div>
              </div>

              {/* Progress percentage */}
              <div className="text-right">
                <span className="text-xs font-bold text-[#6B5E55]">
                  {language === "mr" ? "प्रगती" : "Progress"}
                </span>
                <p className="text-lg font-black text-[#4F7B55]">
                  {Math.round((statusBadge.stepNumber / 4) * 100)}%
                </p>
              </div>
            </div>

            {/* Reference Number Box with Copy & Edit */}
            <div className="rounded-2xl bg-[#FAF7F2] border border-[#E8DFD5] p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex-1 min-w-[200px]">
                <span className="text-[11px] font-bold text-[#6B5E55]">
                  {language === "mr" ? "पोच पावती / अर्ज संदर्भ क्रमांक (Ref ID)" : "Application Reference No:"}
                </span>
                {isEditingRef ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={refNumber}
                      onChange={(e) => setRefNumber(e.target.value)}
                      placeholder="e.g. MH-2026-NSAP-849204"
                      className="px-2.5 py-1 text-xs font-mono font-bold bg-white border border-[#C4714A] rounded-lg w-full max-w-[220px]"
                    />
                    <button
                      onClick={handleSaveRef}
                      className="px-3 py-1 bg-[#4F7B55] text-white rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-mono font-black text-[#2D231E] mt-0.5">
                    {refNumber || "MH-2026-NSAP-849204"}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCopyRef}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#DECFC0] text-xs font-bold text-[#6B5E55] hover:text-[#2D231E]"
                  title="Copy Reference Number"
                >
                  {copiedRef ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#4F7B55]" />
                      <span className="text-[#4F7B55]">{language === "mr" ? "कॉपी झाले" : "Copied"}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{language === "mr" ? "कॉपी" : "Copy"}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingRef(!isEditingRef)}
                  className="text-xs font-bold text-[#C4714A] hover:underline px-1.5 py-1"
                >
                  {isEditingRef ? "Cancel" : language === "mr" ? "बदला" : "Edit"}
                </button>
              </div>
            </div>

            {saveFeedback && (
              <p className="text-xs font-bold text-[#4F7B55] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{saveFeedback}</span>
              </p>
            )}
          </div>

          {/* 4-Stage Government Tracking Workflow Timeline */}
          <div className="bg-white rounded-3xl border border-[#E8DFD5] p-5 shadow-xs">
            <h3 className="text-sm font-black text-[#2D231E] mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#C4714A]" />
              <span>{language === "mr" ? "शासकीय छाननी टप्पे (Government Review Pipeline)" : "Government Review Pipeline"}</span>
            </h3>

            <div className="space-y-6 relative pl-3 sm:pl-4">
              {/* Connecting line */}
              <div className="absolute left-6 sm:left-7 top-4 bottom-4 w-0.5 bg-[#E8DFD5]" />

              {/* Milestone 1: Submission */}
              <div className="relative flex items-start gap-3.5 z-10">
                <div className="w-8 h-8 rounded-full bg-[#4F7B55] text-white flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0 border-2 border-white">
                  <Check className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs sm:text-sm font-black text-[#2D231E]">
                      {language === "mr" ? "१. अर्ज सादर केला (Setu / CSC Submission)" : "1. Application Submitted"}
                    </h4>
                    <span className="text-[10px] font-bold text-[#4F7B55] bg-[#EBF2EC] px-2 py-0.5 rounded-full">
                      {language === "mr" ? "पूर्ण" : "Completed"}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B5E55] mt-0.5">
                    {language === "mr"
                      ? "महा-ई-सेवा केंद्रावर बायोमेट्रिक पडताळणीसह अर्ज स्वीकारला गेला. पोच पावती निर्गमित झाली."
                      : "Application submitted at Seva Kendra with biometrics and acknowledgement generated."}
                  </p>
                </div>
              </div>

              {/* Milestone 2: Document Verification */}
              <div className="relative flex items-start gap-3.5 z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0 border-2 border-white ${
                    statusBadge.stepNumber >= 2
                      ? "bg-[#4F7B55] text-white"
                      : "bg-[#EBE2D8] text-[#6B5E55]"
                  }`}
                >
                  {statusBadge.stepNumber > 2 ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs sm:text-sm font-black text-[#2D231E]">
                      {language === "mr" ? "२. कागदपत्र पडताळणी (Tahsil Desk Verification)" : "2. Document Verification"}
                    </h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        statusBadge.stepNumber >= 2
                          ? "text-[#4F7B55] bg-[#EBF2EC]"
                          : "text-[#6B5E55] bg-[#FAF7F2]"
                      }`}
                    >
                      {statusBadge.stepNumber >= 2
                        ? language === "mr" ? "सत्यापित" : "Verified"
                        : language === "mr" ? "प्रलंबित" : "Pending"}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B5E55] mt-0.5">
                    {language === "mr"
                      ? "तहसीलदार टेबलवर उत्पन्न दाखला, रेशन कार्ड आणि १५ वर्षे वास्तव्य अधिवास तपासणी."
                      : "Tahsildar desk verified income certificate, domicile, and ration card proofs."}
                  </p>
                </div>
              </div>

              {/* Milestone 3: Sanction Committee */}
              <div className="relative flex items-start gap-3.5 z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0 border-2 border-white ${
                    statusBadge.stepNumber >= 3
                      ? "bg-[#C4714A] text-white animate-pulse"
                      : "bg-[#EBE2D8] text-[#6B5E55]"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs sm:text-sm font-black text-[#2D231E]">
                      {language === "mr" ? "३. तालुका मंजुरी समिती बैठक (Sanction Committee)" : "3. Sanction Committee Approval"}
                    </h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        statusBadge.stepNumber >= 3
                          ? "text-[#C4714A] bg-[#FDF4E7]"
                          : "text-[#6B5E55] bg-[#FAF7F2]"
                      }`}
                    >
                      {statusBadge.stepNumber >= 3
                        ? language === "mr" ? "छाननी सुरू" : "In Progress"
                        : language === "mr" ? "प्रलंबित" : "Upcoming"}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B5E55] mt-0.5">
                    {language === "mr"
                      ? "दरमहा होणाऱ्या तालुकास्तरीय समितीच्या बैठकीत पात्र लाभार्थ्यांची यादी मंजूर केली जाते."
                      : "Monthly taluka welfare committee convenes to sanction eligible beneficiary quota."}
                  </p>
                </div>
              </div>

              {/* Milestone 4: DBT Benefit Disbursement */}
              <div className="relative flex items-start gap-3.5 z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0 border-2 border-white ${
                    statusBadge.stepNumber >= 4
                      ? "bg-[#4F7B55] text-white"
                      : "bg-[#EBE2D8] text-[#6B5E55]"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs sm:text-sm font-black text-[#2D231E]">
                      {language === "mr" ? "४. थेट बँक खात्यात निधी जमा (DBT Disbursement)" : "4. Direct Benefit Transfer (DBT)"}
                    </h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        statusBadge.stepNumber >= 4
                          ? "text-[#4F7B55] bg-[#EBF2EC]"
                          : "text-[#6B5E55] bg-[#FAF7F2]"
                      }`}
                    >
                      {statusBadge.stepNumber >= 4
                        ? language === "mr" ? "जमा झाले" : "Disbursed"
                        : language === "mr" ? "शेवटचा टप्पा" : "Final Stage"}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B5E55] mt-0.5">
                    {language === "mr"
                      ? "PFMS प्रणालीद्वारे आधार संलग्न बँक खात्यात थेट मासिक पेन्शन जमा केली जाईल."
                      : "Monthly financial aid directly credited to Aadhaar-seeded bank account via PFMS."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Simulation / Test Control Card */}
          <div className="rounded-3xl bg-[#FAF7F2] border border-[#E8DFD5] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#2D231E] flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-[#C4714A]" />
                <span>
                  {language === "mr"
                    ? "थेट स्थिती चाचणी (Live Demo Status Advance)"
                    : "Live Demo Status Advancement"}
                </span>
              </span>
              <button
                type="button"
                onClick={handleAdvanceStatus}
                className="px-3 py-1.5 rounded-xl bg-[#4F7B55] hover:bg-[#3F6444] text-white font-black text-xs shadow-xs transition-transform active:scale-95 flex items-center gap-1"
              >
                <span>{language === "mr" ? "पुढील टप्प्यावर जा →" : "Advance Stage →"}</span>
              </button>
            </div>
            <p className="text-xs text-[#6B5E55]">
              {language === "mr"
                ? "या बटनावर क्लिक करून आपण अर्जाचा पुढील टप्पा आणि त्यासंबंधी येणाऱ्या SMS सूचनांचा प्रत्यक्ष अनुभव घेऊ शकता."
                : "Click to advance this application to the next government stage and trigger a real-time SMS alert."}
            </p>
          </div>

          {/* Simulated SMS Alert Card */}
          <div className="rounded-3xl bg-[#EBF2EC] border border-[#CADBCB] p-4.5 shadow-xs flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-[#4F7B55] text-white flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bell className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-[#2D231E]">
                  {language === "mr" ? "अधिकृत SMS सूचना (Govt SMS Alert)" : "Government SMS Alert"}
                </h4>
                <Link
                  to="/inbox"
                  className="text-[11px] font-bold text-[#4F7B55] hover:underline"
                >
                  {language === "mr" ? "सर्व संदेश पहा →" : "View SMS Inbox →"}
                </Link>
              </div>
              <p className="text-xs text-[#2D231E] mt-1 font-mono bg-white/70 p-2.5 rounded-xl border border-[#CADBCB]">
                {latestSms ||
                  (language === "mr"
                    ? `प्रिय नागरिक, आपला अर्ज (Ref: ${refNumber}) तालुका मंजुरी समितीकडे छाननीसाठी पुढे सरकला आहे.`
                    : `Dear Citizen, your application (${refNumber}) is under active review by the Sanction Committee.`)}
              </p>
            </div>
          </div>

          {/* Help & Nearest Kendra */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => switchTab("guide")}
              className="text-xs font-bold text-[#C4714A] hover:underline flex items-center gap-1"
            >
              <span>← {language === "mr" ? "अर्ज मार्गदर्शक पुन्हा पहा" : "Back to Application Guide"}</span>
            </button>

            <Link
              to="/help-centres"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-[#E8DFD5] text-[#2D231E] hover:border-[#4F7B55] text-xs font-bold shadow-xs"
            >
              <MapPin className="w-3.5 h-3.5 text-[#4F7B55]" />
              <span>{language === "mr" ? "जवळचे सेवा केंद्र शोधा" : "Find Nearest Seva Kendra"}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
