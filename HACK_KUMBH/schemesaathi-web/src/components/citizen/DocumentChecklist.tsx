import React from "react";
import { useTranslation } from "../../context/I18nContext";
import { Check, X, AlertCircle, Clock, CheckCircle2, AlertTriangle, Upload } from "lucide-react";

export type DocStatus = "have" | "missing" | "expired";

interface DocumentChecklistProps {
  documentId: string;
  name: string;
  currentStatus: DocStatus;
  onChangeStatus: (status: DocStatus) => void;
  prerequisites?: string[];
  unlocksCount?: number;
}

export const DocumentChecklist: React.FC<DocumentChecklistProps> = ({
  documentId,
  name,
  currentStatus,
  onChangeStatus,
  prerequisites = [],
  unlocksCount = 0,
}) => {
  const { t, language } = useTranslation();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#E8DFD5] bg-white p-4 shadow-xs hover:border-[#C4714A] transition-all">
      <div className="flex items-start gap-3 flex-1">
        {/* Status Icon matching 5_Document_Checklist.png */}
        <div className="mt-0.5 flex-shrink-0">
          {currentStatus === "have" ? (
            <div className="w-8 h-8 rounded-full bg-[#EBF2EC] text-[#4F7B55] flex items-center justify-center font-black">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : currentStatus === "missing" ? (
            <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-black">
              <AlertCircle className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-amber-100 text-[#C4714A] flex items-center justify-center font-black">
              <Clock className="w-5 h-5" />
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-[#2D231E] text-sm sm:text-base leading-snug">
              {name}
            </h4>
            {/* Status Pills matching 5_Document_Checklist.png */}
            {currentStatus === "have" && (
              <span className="text-[11px] font-bold text-[#4F7B55] bg-[#EBF2EC] px-2 py-0.5 rounded-full border border-[#CADBCB]">
                ✓ Verified
              </span>
            )}
            {currentStatus === "missing" && (
              <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                ! Missing
              </span>
            )}
            {currentStatus === "expired" && (
              <span className="text-[11px] font-bold text-[#C4714A] bg-[#FDF4E7] px-2 py-0.5 rounded-full border border-[#F4DEC3]">
                ⏱ Expires in 30 days
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6B5E55]">
            {prerequisites.length > 0 && (
              <span>
                {t("needs_prerequisites")}: {prerequisites.join(", ")}
              </span>
            )}
            {unlocksCount > 0 && (
              <span className="font-semibold text-[#4F7B55]">
                • {t("unlocks")} {unlocksCount} {t("schemes")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action / Toggle Buttons matching 5_Document_Checklist.png */}
      <div className="flex items-center gap-2 self-start sm:self-center pt-1 sm:pt-0">
        {currentStatus === "missing" ? (
          <button
            type="button"
            onClick={() => onChangeStatus("have")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border-2 border-[#4F7B55] bg-white text-[#4F7B55] hover:bg-[#EBF2EC] text-xs font-bold transition-all shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>
        ) : currentStatus === "expired" ? (
          <button
            type="button"
            onClick={() => onChangeStatus("have")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border-2 border-[#4F7B55] bg-white text-[#4F7B55] hover:bg-[#EBF2EC] text-xs font-bold transition-all shadow-xs"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Renew</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onChangeStatus("missing")}
            className="text-[11px] text-[#8C7E74] hover:text-[#C4714A] font-semibold underline px-2 py-1"
          >
            Change
          </button>
        )}

        {/* Status Cycle Button */}
        <div className="flex items-center bg-[#FAF7F2] p-0.5 rounded-xl border border-[#E8DFD5]">
          <button
            type="button"
            onClick={() => onChangeStatus("have")}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
              currentStatus === "have" ? "bg-[#4F7B55] text-white" : "text-[#6B5E55]"
            }`}
          >
            ✓ Have
          </button>
          <button
            type="button"
            onClick={() => onChangeStatus("missing")}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
              currentStatus === "missing" ? "bg-red-600 text-white" : "text-[#6B5E55]"
            }`}
          >
            Missing
          </button>
        </div>
      </div>
    </div>
  );
};
