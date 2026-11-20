import React, { useState } from "react";
import { useTranslation } from "../../context/I18nContext";
import { AudioReadButton } from "../common/AudioReadButton";
import {
  CheckCircle,
  AlertCircle,
  HelpCircle,
  FileText,
  Calendar,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  ShieldCheck,
  PlusCircle,
  Globe,
  Building2,
  CheckCircle2,
  ArrowRight,
  Landmark,
} from "lucide-react";
import type { MemberSchemeResult } from "../../api/types";
import { Link, useNavigate } from "react-router-dom";

interface SchemeCardProps {
  scheme: MemberSchemeResult;
  onOpenWhatToConfirm?: (scheme: MemberSchemeResult) => void;
}

export interface SchemePortalInfo {
  name: string;
  url: string;
  mode: string;
}

export const getSchemePortal = (schemeId: string, schemeName?: string, raw?: any): SchemePortalInfo => {
  if (raw?.official_portal_url && typeof raw.official_portal_url === "string" && raw.official_portal_url.startsWith("http")) {
    return {
      name: raw.official_portal_name || "Official Government Scheme Portal",
      url: raw.official_portal_url,
      mode: raw.application_mode || "Online Portal / CSC",
    };
  }

  const upper = (schemeId + " " + (schemeName || "")).toUpperCase();

  // Flagship Health
  if (upper.includes("PMJAY") || upper.includes("MOHFW-PMJAY") || upper.includes("AYUSHMAN") || upper.includes("VAYA VANDANA")) {
    return {
      name: "National Health Authority PM-JAY Beneficiary Portal (beneficiary.nha.gov.in)",
      url: "https://beneficiary.nha.gov.in/",
      mode: "Online Portal + Network Hospital Arogyamitra",
    };
  }
  if (upper.includes("MJPJAY") || upper.includes("MAHATMA JYOTIRAO PHULE") || upper.includes("JAN AROGYA")) {
    return {
      name: "Mahatma Jyotirao Phule Jan Arogya Portal (jeevandayee.gov.in)",
      url: "https://www.jeevandayee.gov.in/",
      mode: "Empanelled Network Hospitals",
    };
  }

  // Flagship Pensions
  if (upper.includes("NSAP") || upper.includes("IGNOAPS") || upper.includes("IGNWPS") || upper.includes("IGNDPS") || upper.includes("NFBS")) {
    return {
      name: "National Social Assistance Programme (NSAP) Portal",
      url: "https://nsap.nic.in/",
      mode: "Online Portal / Tahsil Office",
    };
  }
  if (upper.includes("SANJAY") || upper.includes("NIRADHAR") || upper.includes("SHRAVAN") || upper.includes("BAL") || upper.includes("AAPLE SARKAR")) {
    return {
      name: "आपले सरकार पोर्टल (Aaple Sarkar Maharashtra)",
      url: "https://aaplesarkar.mahaonline.gov.in/",
      mode: "Online / Setu Suvidha Kendra",
    };
  }

  // Flagship Agriculture
  if (upper.includes("PMKISAN") || upper.includes("PM-KISAN") || upper.includes("NAMO SHETKARI")) {
    return {
      name: "PM-Kisan Samman Nidhi & Namo Shetkari Portal",
      url: "https://pmkisan.gov.in/",
      mode: "Online Portal / CSC Centre / Agriculture Dept",
    };
  }
  if (upper.includes("PMFBY") || upper.includes("FASAL BIMA") || upper.includes("CROP INSURANCE")) {
    return {
      name: "Pradhan Mantri Fasal Bima Yojana Portal",
      url: "https://pmfby.gov.in/",
      mode: "Online / Bank Branch / CSC",
    };
  }
  if (upper.includes("KCC") || upper.includes("KISAN CREDIT")) {
    return {
      name: "Kisan Credit Card (KCC) Portal",
      url: "https://pmkisan.gov.in/",
      mode: "Commercial Banks / District Cooperative Banks",
    };
  }
  if (upper.includes("SOIL HEALTH")) {
    return {
      name: "Soil Health Card National Portal",
      url: "https://soilhealth.dac.gov.in/",
      mode: "Agriculture Department / Krishi Vigyan Kendra",
    };
  }

  // Women & Children
  if (upper.includes("LADKI BAHIN") || upper.includes("LADAKIBuserAHIN") || upper.includes("MAJHI LADKI") || upper.includes("LADKI")) {
    return {
      name: "मुख्यमंत्री माझी लाडकी बहीण योजना पोर्टल",
      url: "https://ladakibahin.maharashtra.gov.in/",
      mode: "Nari Shakti Doot App / Setu Kendra / Anganwadi",
    };
  }
  if (upper.includes("PMMVY") || upper.includes("MATRITVA VANDANA")) {
    return {
      name: "Pradhan Mantri Matru Vandana Yojana (PMMVY) Portal",
      url: "https://pmmvy.wcd.gov.in/",
      mode: "Anganwadi Centre / PMMVY Online Portal",
    };
  }
  if (upper.includes("SUKANYA")) {
    return {
      name: "Sukanya Samriddhi Yojana (India Post)",
      url: "https://www.indiapost.gov.in/",
      mode: "Post Office / Nationalized Bank Branch",
    };
  }

  // Housing
  if (upper.includes("PMAY-G") || upper.includes("PMAYG") || upper.includes("AWAS GRAMIN") || upper.includes("RAMAI") || upper.includes("SHABARI")) {
    return {
      name: "Pradhan Mantri Awaas Yojana - Gramin (AwaasSoft)",
      url: "https://pmayg.nic.in/",
      mode: "Gram Panchayat / Block Development Office",
    };
  }
  if (upper.includes("PMAY-U") || upper.includes("PMAYU") || upper.includes("AWAS URBAN") || upper.includes("PMAYMIS")) {
    return {
      name: "Pradhan Mantri Awas Yojana - Urban 2.0 Portal",
      url: "https://pmaymis.gov.in/",
      mode: "Municipal Corporation (NMC) / ULB Office",
    };
  }

  // Vendors & Small Business
  if (upper.includes("PMSVANIDHI") || upper.includes("SVANIDHI") || upper.includes("STREET VENDOR")) {
    return {
      name: "PM SVANidhi Micro-Credit Portal",
      url: "https://pmsvanidhi.mohua.gov.in/",
      mode: "Online Portal / Municipal Town Vending Committee (TVC)",
    };
  }
  if (upper.includes("VISHWAKARMA")) {
    return {
      name: "PM Vishwakarma Portal (pmvishwakarma.gov.in)",
      url: "https://pmvishwakarma.gov.in/",
      mode: "CSC Biometric Verification / MSME",
    };
  }
  if (upper.includes("MUDRA")) {
    return {
      name: "Pradhan Mantri Mudra Yojana Portal",
      url: "https://www.mudra.org.in/",
      mode: "Public Sector Banks / NBFCs",
    };
  }
  if (upper.includes("STAND UP") || upper.includes("STANDUP")) {
    return {
      name: "Stand-Up India Portal (SIDBI)",
      url: "https://www.standupmitra.in/",
      mode: "Online / Lead District Manager",
    };
  }

  // Workers & Social Security
  if (upper.includes("PMSYM") || upper.includes("SHRAM YOGI") || upper.includes("MAANDHAN")) {
    return {
      name: "Pradhan Mantri Shram Yogi Maandhan (maandhan.in)",
      url: "https://maandhan.in/",
      mode: "Common Service Centre (CSC) / LIC",
    };
  }
  if (upper.includes("ESHRAM") || upper.includes("E-SHRAM")) {
    return {
      name: "e-Shram National Database of Unorganised Workers",
      url: "https://eshram.gov.in/",
      mode: "Online Self-Registration / CSC",
    };
  }
  if (upper.includes("BOCW") || upper.includes("MAHABOCW") || upper.includes("CONSTRUCTION")) {
    return {
      name: "Maharashtra Building & Other Construction Workers Board (MahaBOCW)",
      url: "https://mahabocw.in/",
      mode: "MahaBOCW Portal / District Labour Office",
    };
  }
  if (upper.includes("APY") || upper.includes("ATAL PENSION")) {
    return {
      name: "Atal Pension Yojana (NPS CRA)",
      url: "https://www.npscra.nsdl.co.in/",
      mode: "Savings Bank Account Branch",
    };
  }

  // Energy & Environment
  if (upper.includes("SURYA GHAR") || upper.includes("SOLAR") || upper.includes("ROOFTOP")) {
    return {
      name: "PM Surya Ghar: Muft Bijli Yojana National Portal",
      url: "https://pmsuryaghar.gov.in/",
      mode: "National Rooftop Solar Portal / MSEDCL",
    };
  }
  if (upper.includes("UJJWALA") || upper.includes("PMUY") || upper.includes("LPG")) {
    return {
      name: "Pradhan Mantri Ujjwala Yojana 2.0 (pmuy.gov.in)",
      url: "https://pmuy.gov.in/",
      mode: "Bharat Gas / Indane / HP Gas Distributor",
    };
  }

  // Scholarships & Education
  if (upper.includes("MAHADBT") || upper.includes("POST-MATRIC") || upper.includes("SWADHAR")) {
    return {
      name: "MahaDBT Aaple Sarkar Portal (mahadbt.maharashtra.gov.in)",
      url: "https://mahadbt.maharashtra.gov.in/",
      mode: "Online MahaDBT Portal",
    };
  }
  if (upper.includes("SCHOLARSHIP") || upper.includes("NSP") || upper.includes("ISHAN")) {
    return {
      name: "National Scholarship Portal (NSP scholarships.gov.in)",
      url: "https://scholarships.gov.in/",
      mode: "Online NSP Portal",
    };
  }

  // Fallback to myScheme official portal
  const slug = schemeId.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    name: "National myScheme Official Portal (myscheme.gov.in)",
    url: `https://www.myscheme.gov.in/schemes/${slug}`,
    mode: "Online Application / CSC",
  };
};

export const SchemeCard: React.FC<SchemeCardProps> = ({ scheme, onOpenWhatToConfirm }) => {
  const { t, language } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isStarted, setIsStarted] = useState(() => {
    try {
      const savedApps = localStorage.getItem("schemesaathi_applications");
      if (savedApps) {
        const apps = JSON.parse(savedApps);
        return apps.some((a: any) => a.scheme_id === scheme.scheme_id);
      }
      return false;
    } catch {
      return false;
    }
  });

  const navigate = useNavigate();
  const portal = getSchemePortal(scheme.scheme_id, scheme.official_name, scheme);

  const handleStartApplication = () => {
    try {
      const savedAppsStr = localStorage.getItem("schemesaathi_applications");
      const apps = savedAppsStr ? JSON.parse(savedAppsStr) : [];
      if (!apps.some((a: any) => a.scheme_id === scheme.scheme_id)) {
        apps.push({
          scheme_id: scheme.scheme_id,
          scheme_name: scheme.official_name,
          started_at: new Date().toISOString(),
          status: "in_progress",
        });
        localStorage.setItem("schemesaathi_applications", JSON.stringify(apps));
      }
      setIsStarted(true);
      navigate(`/applications/${scheme.scheme_id}`);
    } catch {
      navigate(`/applications/${scheme.scheme_id}`);
    }
  };

  const getTierBadge = () => {
    switch (scheme.tier) {
      case "can_apply":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EBF2EC] px-3 py-1 text-xs font-black text-[#4F7B55] border border-[#CADBCB]">
            <CheckCircle className="h-3.5 w-3.5 text-[#4F7B55]" />
            <span>{language === "mr" ? "पात्र (Eligible)" : language === "hi" ? "पात्र (Eligible)" : "Eligible"}</span>
          </span>
        );
      case "likely_confirm":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDF4E7] px-3 py-1 text-xs font-black text-[#C4714A] border border-[#F4DEC3]">
            <HelpCircle className="h-3.5 w-3.5 text-[#C4714A]" />
            <span>{language === "mr" ? "खात्री आवश्यक" : "Needs Confirmation"}</span>
          </span>
        );
      case "explore":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-200">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            <span>{language === "mr" ? "अधिक माहिती" : "Explore"}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            <span>{scheme.status}</span>
          </span>
        );
    }
  };

  const localizedReasons =
    language === "mr" && scheme.reasons?.mr?.length
      ? scheme.reasons.mr
      : scheme.reasons?.en || [];

  const audioContent = `${scheme.official_name}. ${localizedReasons.join(". ")}.`;

  return (
    <div className="relative rounded-2xl border border-[#E8DFD5] bg-white p-3.5 sm:p-5 shadow-xs transition-all hover:border-[#C4714A] hover:shadow-md overflow-hidden">
      {/* Top Header: Responsive Meta Bar + Full-width Title for perfect mobile flow */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#F6ECE4] text-[#C4714A] flex items-center justify-center flex-shrink-0 shadow-xs">
            <Landmark className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-[10px] font-mono font-bold text-[#8C7E74] bg-[#FAF7F2] px-2 py-0.5 rounded-md border border-[#E8DFD5] whitespace-nowrap">
            {scheme.scheme_id}
          </span>
          {scheme.is_curated && (
            <span className="text-[10px] font-bold text-[#4F7B55] bg-[#EBF2EC] px-2 py-0.5 rounded-full whitespace-nowrap">
              Verified Rule
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
          {getTierBadge()}
          <AudioReadButton text={audioContent} size="sm" />
        </div>
      </div>

      {/* Scheme Title: Takes FULL 100% card width so it never squishes into awkward 1-word towers */}
      <h3 className="mt-2.5 text-sm sm:text-base font-black text-[#2D231E] leading-snug break-words">
        {scheme.official_name}
      </h3>

      {/* Localized Reason Pills */}
      {localizedReasons.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {localizedReasons.map((reason, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded-xl bg-[#FAF7F2] px-2.5 py-1 text-xs text-[#6B5E55] border border-[#E8DFD5] font-medium leading-relaxed break-words max-w-full"
            >
              <CheckCircle className="h-3 w-3 text-[#4F7B55] flex-shrink-0" />
              <span>{reason}</span>
            </span>
          ))}
        </div>
      )}

      {/* Missing Details / What to Confirm Banner */}
      {scheme.tier === "likely_confirm" && scheme.what_to_confirm && scheme.what_to_confirm.length > 0 && (
        <div className="mt-3.5 rounded-2xl border border-[#F4DEC3] bg-[#FDF4E7] p-3 sm:p-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#944C2B]">
                {scheme.what_to_confirm.length} {t("missing_details_count")}
              </p>
              <p className="text-xs text-[#B05E38] mt-0.5 leading-relaxed">
                {t("answer_to_check_eligibility")}
              </p>
            </div>
            {onOpenWhatToConfirm && (
              <button
                type="button"
                onClick={() => onOpenWhatToConfirm(scheme)}
                className="w-full sm:w-auto min-h-[40px] rounded-xl bg-[#C4714A] hover:bg-[#B05E38] px-4 py-2 text-xs font-bold text-white shadow-xs active:scale-95 transition flex items-center justify-center whitespace-nowrap flex-shrink-0"
              >
                {t("confirm_now")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* OFFICIAL PORTAL LINK & ACTION GUIDANCE IN WARM THEME */}
      {(scheme.tier === "can_apply" || scheme.tier === "likely_confirm") && (
        <div className="mt-3.5 rounded-2xl border border-[#E8DFD5] bg-[#FAF7F2] p-3 sm:p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="text-xs font-black text-[#2D231E] flex items-center gap-1.5 min-w-0">
              <Globe className="w-4 h-4 text-[#C4714A] flex-shrink-0" />
              <span className="truncate">
                {language === "mr"
                  ? "अधिकृत शासकीय ऑनलाइन पोर्टल"
                  : language === "hi"
                  ? "आधिकारिक सरकारी ऑनलाइन पोर्टल"
                  : "Official Government Online Portal"}
              </span>
            </span>
            <span className="text-[10px] font-bold bg-[#E8DFD5] text-[#2D231E] px-2 py-0.5 rounded-full whitespace-nowrap">
              {portal.mode}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <span className="text-xs text-[#6B5E55] font-semibold break-words flex-1 min-w-0">
              {portal.name}
            </span>
            <a
              href={portal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C4714A] hover:bg-[#B05E38] text-white font-bold text-xs shadow-xs transition-transform active:scale-95 whitespace-nowrap flex-shrink-0"
            >
              <span>{language === "mr" ? "पोर्टलवर अर्ज करा" : "Open Govt Portal"}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Bottom Actions & Expandable 3-Way Guide */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 border-t border-[#E8DFD5] pt-3">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs font-semibold text-[#6B5E55] hover:text-[#C4714A] transition-colors py-1"
          aria-expanded={isExpanded}
        >
          <span>
            {isExpanded
              ? t("hide_details")
              : language === "mr"
              ? "कागदपत्रे व अर्ज पद्धत ▼"
              : "Ways to Apply & Documents ▼"}
          </span>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {scheme.tier === "can_apply" && (
          <button
            type="button"
            data-testid={`start-app-${scheme.scheme_id}`}
            onClick={handleStartApplication}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black shadow-xs transition-transform active:scale-95 whitespace-nowrap ${
              isStarted
                ? "bg-[#EBF2EC] text-[#4F7B55] border border-[#CADBCB]"
                : "bg-[#4F7B55] hover:bg-[#3F6444] text-white"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {isStarted
                ? (language === "mr" ? "अर्जात समाविष्ट ✓" : "In Application ✓")
                : (language === "mr" ? "अर्ज सुरू करा →" : "Start Application →")}
            </span>
          </button>
        )}
      </div>

      {/* Expanded Drawer */}
      {isExpanded && (
        <div className="mt-3 space-y-4 rounded-2xl bg-[#FAF7F2] p-4 text-xs border border-[#E8DFD5]">
          {/* 3 Ways to Apply Guide */}
          <div className="rounded-xl bg-white p-3.5 border border-[#E8DFD5] space-y-2">
            <h4 className="font-black text-[#2D231E] text-xs flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#4F7B55]" />
              <span>{language === "mr" ? "अर्ज करण्याच्या ३ पद्धती (Ways to Apply):" : "3 Ways to Apply:"}</span>
            </h4>
            <div className="space-y-1.5 text-[#6B5E55] leading-relaxed text-[11px]">
              <p>
                <strong className="text-[#2D231E]">
                  {language === "mr" ? "१. ऑनलाइन पद्धत:" : "1. Online Method:"}
                </strong>{" "}
                {language === "mr"
                  ? "अधिकृत पोर्टलवर जाऊन आधार क्रमांकाने नोंदणी करा, फॉर्म भरा व आवश्यक कागदपत्रे जोडा."
                  : "Visit official portal, login with Aadhaar OTP, fill form and upload documents."}
              </p>
              <p>
                <strong className="text-[#2D231E]">
                  {language === "mr" ? "२. सेतू सुविधा केंद्र / ऑफलाइन:" : "2. Setu Kendra / Offline:"}
                </strong>{" "}
                {language === "mr"
                  ? "जवळच्या सेतू सुविधा केंद्र किंवा तहसील कार्यालयात प्रत्यक्ष जाऊन कागदपत्रांच्या झेरॉक्ससह अर्ज जमा करा."
                  : "Visit nearest Setu Suvidha Kendra / CSC Center / Tahsil office with physical copies of documents."}
              </p>
              <p>
                <strong className="text-[#2D231E]">
                  {language === "mr" ? "३. योजनासाथी ट्रॅकर:" : "3. SchemeSaathi Tracker:"}
                </strong>{" "}
                {language === "mr"
                  ? "'अर्ज सुरू करा' बटण दाबून आपल्या कागदपत्रांची तयारी तपासा व एसएमएस सूचना मिळवा."
                  : "Click 'Start Application' to track progress and get SMS updates."}
              </p>
            </div>
          </div>

          {scheme.pre_trip_check?.bring_documents && scheme.pre_trip_check.bring_documents.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 font-bold text-[#2D231E]">
                <FileText className="h-4 w-4 text-[#4F7B55]" />
                {t("documents_to_bring")}:
              </h4>
              <ul className="mt-1.5 space-y-1 pl-5 list-disc text-[#6B5E55]">
                {scheme.pre_trip_check.bring_documents.map((doc) => (
                  <li key={doc.document_id}>
                    <span className="font-medium text-[#2D231E]">{doc.name}</span>
                    {doc.mandatory && (
                      <span className="ml-1 text-rose-600 font-semibold">({t("mandatory")})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
