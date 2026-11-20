import React, { useState, useEffect } from "react";
import { useHousehold } from "../../context/HouseholdContext";
import { useTranslation } from "../../context/I18nContext";
import { apiClient } from "../../api/client";
import { DocumentChecklist, type DocStatus } from "./DocumentChecklist";
import { AudioReadButton } from "../common/AudioReadButton";
import { Link } from "react-router-dom";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  MapPin,
  Clock,
  Sparkles,
  Layers,
  Building2,
  ExternalLink,
  BookmarkCheck,
  Upload,
  Calendar,
} from "lucide-react";
import type { DocumentPlanResponse } from "../../api/types";

interface SyntheticDocStep {
  step: number;
  document_id: string;
  name: string;
  prerequisites: string[];
  unlocks_schemes_count: number;
  office: string;
}

export const DocumentPlanView: React.FC = () => {
  const { householdId, evaluation } = useHousehold();
  const { t, language } = useTranslation();

  const [plan, setPlan] = useState<DocumentPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appliedSchemes, setAppliedSchemes] = useState<Array<{ id: string; name: string }>>([]);

  const [docStatuses, setDocStatuses] = useState<Record<string, DocStatus>>(() => {
    try {
      const saved = localStorage.getItem(`doc_statuses_${householdId}`);
      return saved
        ? JSON.parse(saved)
        : {
            DOC_AADHAAR: "have",
            DOC_INCOME_CERT: "expired",
            DOC_DOMICILE: "have",
            DOC_RATION_CARD: "have",
            DOC_BANK_PASSBOOK: "missing",
          };
    } catch {
      return {
        DOC_AADHAAR: "have",
        DOC_INCOME_CERT: "expired",
        DOC_DOMICILE: "have",
        DOC_RATION_CARD: "have",
        DOC_BANK_PASSBOOK: "missing",
      };
    }
  });

  useEffect(() => {
    try {
      const savedAppsStr = localStorage.getItem("schemesaathi_applications");
      if (savedAppsStr) {
        const apps = JSON.parse(savedAppsStr);
        setAppliedSchemes(
          apps.map((a: any) => ({
            id: a.scheme_id,
            name: a.scheme_name || a.scheme_id,
          }))
        );
      }
    } catch {}

    let isMounted = true;
    async function loadPlan() {
      try {
        setLoading(true);
        const data = await apiClient.getDocumentPlan(householdId);
        if (isMounted && data && data.chain_plan && data.chain_plan.length > 0) {
          setPlan(data);
        }
      } catch {
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadPlan();
    return () => {
      isMounted = false;
    };
  }, [householdId]);

  const handleStatusChange = (docId: string, status: DocStatus) => {
    const updated = { ...docStatuses, [docId]: status };
    setDocStatuses(updated);
    try {
      localStorage.setItem(`doc_statuses_${householdId}`, JSON.stringify(updated));
    } catch {}
  };

  const canApplyList = evaluation?.results?.[0]?.tiers?.can_apply || [];

  const buildSynthesizedSteps = (): SyntheticDocStep[] => {
    const steps: SyntheticDocStep[] = [
      {
        step: 1,
        document_id: "DOC_AADHAAR",
        name:
          language === "mr"
            ? "आधार कार्ड (बँक व मोबाईल जोडलेले)"
            : language === "hi"
            ? "आधार कार्ड (बैंक व मोबाइल से लिंक)"
            : "Aadhaar Card (Bank & Mobile Linked)",
        prerequisites: [],
        unlocks_schemes_count: 5,
        office: language === "mr" ? "महा-ई-सेवा केंद्र / पोस्ट ऑफिस" : "CSC Centre / Post Office",
      },
      {
        step: 2,
        document_id: "DOC_INCOME_CERT",
        name:
          language === "mr"
            ? "तहसीलदार वार्षिक उत्पन्न दाखला (उत्पन्न मर्यादा प्रमाणपत्र)"
            : language === "hi"
            ? "तहसीलदार वार्षिक आय प्रमाण पत्र"
            : "Income Certificate (Tahsildar)",
        prerequisites: [
          language === "mr" ? "आधार कार्ड" : "Aadhaar Card",
          language === "mr" ? "रेशन कार्ड" : "Ration Card",
        ],
        unlocks_schemes_count: 4,
        office: language === "mr" ? "तहसील कार्यालय / सेतू सुविधा केंद्र" : "Tahsil Office / Setu Kendra",
      },
      {
        step: 3,
        document_id: "DOC_DOMICILE",
        name:
          language === "mr"
            ? "महाराष्ट्र राज्य अधिवास दाखला (१५ वर्षे वास्तव्य पुरावा)"
            : language === "hi"
            ? "महाराष्ट्र राज्य अधिवास प्रमाण पत्र"
            : "Maharashtra Domicile Certificate (15 Yrs)",
        prerequisites: [
          language === "mr" ? "शाळा सोडल्याचा दाखला" : "TC / Birth Certificate",
          language === "mr" ? "आधार कार्ड" : "Aadhaar Card",
        ],
        unlocks_schemes_count: 3,
        office: language === "mr" ? "तहसीलदार / सेतू केंद्र" : "Tahsil / Setu Kendra",
      },
      {
        step: 4,
        document_id: "DOC_RATION_CARD",
        name:
          language === "mr"
            ? "रेशन कार्ड (पिवळे BPL / अंत्योदय / केशरी) झेरॉक्स"
            : language === "hi"
            ? "राशन कार्ड (पीला BPL / अंत्योदय / नारंगी)"
            : "Ration Card (Yellow BPL / Antyodaya / Orange)",
        prerequisites: [language === "mr" ? "आधार कार्ड" : "Aadhaar Card"],
        unlocks_schemes_count: 4,
        office: language === "mr" ? "अन्न व नागरी पुरवठा विभाग" : "Food & Civil Supplies Dept",
      },
      {
        step: 5,
        document_id: "DOC_BANK_PASSBOOK",
        name:
          language === "mr"
            ? "राष्ट्रीयकृत बँक पासबुक झेरॉक्स (Aadhaar NPCI मॅप केलेले)"
            : language === "hi"
            ? "बैंक पासबुक (आधार NPCI सीडेड)"
            : "Bank Account Details (NPCI Mapped)",
        prerequisites: [language === "mr" ? "आधार कार्ड" : "Aadhaar Card"],
        unlocks_schemes_count: 5,
        office: language === "mr" ? "बँक शाखा / सीएससी" : "Bank Branch / CSC",
      },
    ];

    const hasWidow =
      appliedSchemes.some((s) => s.id.includes("NSAP") || s.id.includes("SANJAY")) ||
      canApplyList.some((s) => s.scheme_id.includes("NSAP") || s.scheme_id.includes("SANJAY"));

    if (hasWidow) {
      steps.push({
        step: 6,
        document_id: "DOC_DEATH_CERT",
        name:
          language === "mr"
            ? "पतीचा अधिकृत मृत्यू दाखला (Spouse Death Certificate)"
            : language === "hi"
            ? "पति का मृत्यु प्रमाण पत्र"
            : "Spouse Death Certificate",
        prerequisites: [language === "mr" ? "दवाखाना / स्मशान पावती" : "Hospital record"],
        unlocks_schemes_count: 2,
        office: language === "mr" ? "ग्रामपंचायत / मनपा जन्म-मृत्यू विभाग" : "Gram Panchayat / Municipal Office",
      });
    }

    return steps;
  };

  const steps = plan?.chain_plan && plan.chain_plan.length > 0 ? plan.chain_plan : buildSynthesizedSteps();
  const haveCount = Object.values(docStatuses).filter((s) => s === "have").length;
  const audioText = `${t("document_plan_title")}. ${t("optimal_sequence_audio")}. ${steps.length} ${t("documents_needed")}.`;

  const missingOrExpiredCount = Object.values(docStatuses).filter((s) => s === "missing" || s === "expired").length;

  return (
    <div className="mx-auto max-w-4xl px-2 sm:px-4 py-4 text-[#2D231E]">
      {/* 5_Document_Checklist.png Warning Banner */}
      {missingOrExpiredCount > 0 && (
        <div className="mb-4 rounded-2xl border border-[#F4DEC3] bg-[#FDF4E7] p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F6ECE4] text-[#C4714A] flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-[#944C2B]">
                {language === "mr"
                  ? "काही कागदपत्रे उपलब्ध नाहीत किंवा मुदत संपत आहे!"
                  : language === "hi"
                  ? "कुछ दस्तावेज अनुपलब्ध हैं या समाप्त हो रहे हैं!"
                  : "Some documents are missing or expiring soon!"}
              </h3>
              <p className="text-[11px] text-[#B05E38] mt-0.5">
                {language === "mr"
                  ? "योजनांच्या अर्जासाठी खालील आवश्यक कागदपत्रे वेळेत पूर्ण करा किंवा नूतनीकरण करा."
                  : "Please upload missing documents or renew expiring certificates to avoid rejection."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E8DFD5] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-[#2D231E] tracking-tight">
              {t("document_plan_title") || (language === "mr" ? "कागदपत्र तयारी योजना: एक भेट, अनेक योजना अनलॉक" : language === "hi" ? "दस्तावेज तैयारी योजना: एक दौरा, अनेक योजनाएं" : "Document Preparation Plan: One Visit, Multiple Schemes Unlocked")}
            </h1>
            <AudioReadButton text={audioText} />
          </div>
          <p className="mt-0.5 text-xs text-[#6B5E55] font-medium">
            {t("document_plan_subtitle") || (language === "mr" ? "किमान फेऱ्यांमध्ये जास्तीत जास्त योजनांचे लाभ मिळवण्यासाठी मूळ कागदपत्रे आधी मिळवा." : language === "hi" ? "कम से कम दौरों में अधिक योजनाओं का लाभ पाने के लिए मुख्य दस्तावेज पहले प्राप्त करें।" : "Get key prerequisite documents first to unlock the most schemes in fewer visits.")}
          </p>
        </div>

        <Link
          to="/help-centres"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#2D231E] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#43362F] transition self-start sm:self-center"
        >
          <MapPin className="h-4 w-4 text-[#C4714A]" />
          <span>{t("find_seva_kendra") || (language === "mr" ? "जवळचे सेवा केंद्र शोधा" : language === "hi" ? "नजदीकी सेवा केंद्र खोजें" : "Find Seva Kendra")}</span>
        </Link>
      </div>

      {/* Applied & Eligible Schemes Pipeline Banner */}
      {(appliedSchemes.length > 0 || canApplyList.length > 0) && (
        <div className="mt-4 rounded-2xl border border-[#E8DFD5] bg-white p-3.5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#2D231E] flex items-center gap-1.5">
              <BookmarkCheck className="w-4 h-4 text-[#C4714A]" />
              <span>
                {language === "mr"
                  ? "निवडलेल्या व पात्र योजनांची कागदपत्रे (Tracked Schemes Pipeline)"
                  : "Tracked Schemes & Eligible Welfare Pipeline"}
              </span>
            </span>
            <Link
              to="/applications"
              className="text-xs font-bold text-[#4F7B55] hover:underline flex items-center gap-1"
            >
              <span>{language === "mr" ? "माझे अर्ज पहा →" : "My Applications →"}</span>
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 pt-0.5">
            {appliedSchemes.map((app) => (
              <span
                key={app.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-[#FAF7F2] text-[#2D231E] border border-[#E8DFD5]"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4F7B55]" />
                <span className="truncate max-w-[200px]">{app.name}</span>
                <span className="text-[10px] bg-[#EBF2EC] text-[#4F7B55] px-1.5 py-0.2 rounded font-mono">
                  Applied
                </span>
              </span>
            ))}
            {appliedSchemes.length === 0 &&
              canApplyList.slice(0, 3).map((sc) => (
                <span
                  key={sc.scheme_id}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-[#FAF7F2] text-[#2D231E] border border-[#E8DFD5]"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#4F7B55]" />
                  <span className="truncate max-w-[200px]">{sc.official_name}</span>
                  <span className="text-[10px] bg-[#EBF2EC] text-[#4F7B55] px-1.5 py-0.2 rounded font-mono">
                    Eligible
                  </span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Progress & Value Prop Banner in Tan/Green Gradient */}
      <div className="mt-4 rounded-3xl bg-gradient-to-r from-[#C4714A] to-[#944C2B] p-5 text-white shadow-md border border-[#944C2B]/30">
        <div className="flex items-center gap-2 text-orange-100 text-xs font-black uppercase tracking-wider">
          <Sparkles className="h-4 w-4" />
          <span>{t("smart_dag_sequencing") || "SMART DAG SEQUENCING"}</span>
        </div>
        <h2 className="mt-1 text-lg sm:text-xl font-black tracking-tight leading-snug">
          {t("one_visit_unlocks_multiple") || (language === "mr" ? "एक भेट, अनेक योजना अनलॉक करा" : language === "hi" ? "एक दौरा, अनेक योजनाएं अनलॉक करें" : "One Visit Unlocks Multiple Schemes")}
        </h2>
        <p className="mt-0.5 text-xs text-orange-50 max-w-2xl leading-relaxed">
          {t("smart_dag_explanation") || (language === "mr" ? "प्रथम आवश्यक मूळ प्रमाणपत्रे मिळवून एकाच वेळी अनेक योजनांसाठी पात्र व्हा आणि सरकारी कार्यालयांचे खेटे वाचवा." : language === "hi" ? "पहले जरूरी मुख्य दस्तावेज बनवाकर एक साथ कई योजनाओं का लाभ उठाएं।" : "Acquiring root prerequisites first lets you apply for multiple schemes simultaneously with minimum visits.")}
        </p>

        {steps.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 max-w-md">
              <div className="flex justify-between text-xs font-bold text-orange-100 mb-1">
                <span>
                  {language === "mr" ? "कागदपत्र तयारी प्रगती" : "Preparation Progress"}
                </span>
                <span className="font-mono font-black">
                  {Math.min(100, Math.round((haveCount / steps.length) * 100))}%{" "}
                  {language === "mr" ? "पूर्ण" : "complete"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/20 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round((haveCount / steps.length) * 100))}%`,
                  }}
                />
              </div>
            </div>
            <span className="text-xs font-black text-white bg-white/20 px-3 py-1.5 rounded-xl border border-white/20">
              {haveCount} / {steps.length} {t("ready")}
            </span>
          </div>
        )}
      </div>

      {/* 5_Document_Checklist.png: Required Documents List */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between border-b border-[#E8DFD5] pb-2">
          <h3 className="flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider text-[#2D231E]">
            <Layers className="h-4 w-4 text-[#C4714A]" />
            <span>Required Documents ({steps.length})</span>
          </h3>
          <span className="text-[11px] text-[#6B5E55]">
            {language === "mr" ? "(मूळ दाखले आधी मिळवा)" : "(Root certificates first)"}
          </span>
        </div>

        {steps.map((stepItem) => {
          const status = docStatuses[stepItem.document_id] || "missing";
          return (
            <div key={stepItem.document_id}>
              <DocumentChecklist
                documentId={stepItem.document_id}
                name={stepItem.name}
                currentStatus={status}
                onChangeStatus={(st) => handleStatusChange(stepItem.document_id, st)}
                prerequisites={stepItem.prerequisites}
                unlocksCount={stepItem.unlocks_schemes_count}
              />
            </div>
          );
        })}
      </div>

      {/* 5_Document_Checklist.png: Primary Action Button in GREEN #4F7B55 */}
      <div className="mt-5">
        <button
          type="button"
          onClick={() => {
            // Toggle missing to have for demonstration
            const updated = { ...docStatuses };
            for (const k of Object.keys(updated)) {
              if (updated[k] === "missing") updated[k] = "have";
            }
            setDocStatuses(updated);
          }}
          className="w-full min-h-[48px] py-3.5 px-4 rounded-2xl bg-[#4F7B55] hover:bg-[#3F6444] text-white font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <Upload className="w-5 h-5" />
          <span>Upload Documents / सर्व कागदपत्रे जोडा</span>
        </button>
      </div>

      {/* 5_Document_Checklist.png: Expiry Reminder Card with Calendar Icon */}
      <div className="mt-5 rounded-2xl border border-[#E8DFD5] bg-white p-4 shadow-xs flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-[#F6ECE4] text-[#C4714A] flex items-center justify-center flex-shrink-0">
          <Calendar className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-xs sm:text-sm font-black text-[#2D231E]">
            Expiry Reminder: Income Certificate
          </h4>
          <p className="text-xs text-[#6B5E55] mt-0.5">
            Tahsildar Income Certificate expires on <strong className="text-[#2D231E]">20 Dec 2026</strong>. Renew online at Aaple Sarkar.
          </p>
        </div>
      </div>

      {/* Pre-Trip Preparation Pack Box */}
      <div className="mt-6 rounded-3xl border border-[#E8DFD5] bg-white p-5 shadow-xs space-y-3">
        <h3 className="text-sm font-black text-[#2D231E] flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#C4714A]" />
          <span>{t("pre_trip_prep_title") || (language === "mr" ? "केंद्राला भेट देण्यापूर्वी तयारी (नागपूर व विदर्भ)" : language === "hi" ? "केंद्र जाने से पहले तैयारी" : "Pre-Trip Preparation Pack (Nagpur & Vidarbha)")}</span>
        </h3>
        <p className="text-xs text-[#6B5E55] font-medium leading-relaxed">
          {t("pre_trip_prep_desc") || (language === "mr" ? "सेवा केंद्र किंवा तहसील कार्यालयात जाण्यापूर्वी हे साहित्य सोबत ठेवा जेणेकरून फेऱ्या वाचतील:" : language === "hi" ? "सेवा केंद्र जाने से पहले यह सामग्री साथ रखें:" : "Keep these essential items ready before visiting the CSC or Tahsil office to avoid repeat visits:")}
        </p>

        <ul className="mt-2 space-y-1.5 text-xs text-[#6B5E55] list-disc pl-5 font-medium leading-relaxed">
          <li>{t("prep_tip_1") || (language === "mr" ? "४ नुकतेच काढलेले पासपोर्ट आकाराचे फोटो (सफेद किंवा निळ्या पार्श्वभूमीवर)." : "Keep 4 recent passport-size photos with blue/white background.")}</li>
          <li>{t("prep_tip_2") || (language === "mr" ? "सर्व मूळ कागदपत्रांच्या प्रत्येकी ३ साक्षांकित (self-attested) झेरॉक्स प्रती." : "Keep 3 self-attested photocopies of all original documents.")}</li>
          <li>{t("prep_tip_3") || (language === "mr" ? "आधार नोंदणीकृत मोबाईल फोन सोबत ठेवा (OTP पडताळणीसाठी आवश्यक)." : "Carry Aadhaar-registered mobile phone for instant OTP verification.")}</li>
          <li>{t("prep_tip_4") || (language === "mr" ? "सकाळी १० वाजता केंद्रावर पोहोचा जेणेकरून टोकन लवकर मिळेल." : "Reach the Seva Kendra / Tahsil office early (10 AM) to get a lower queue token.")}</li>
        </ul>
      </div>
    </div>
  );
};
