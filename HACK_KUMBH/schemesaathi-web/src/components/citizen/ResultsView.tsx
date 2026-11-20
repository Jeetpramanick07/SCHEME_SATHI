import React, { useState, useEffect } from "react";
import { useHousehold } from "../../context/HouseholdContext";
import { useTranslation } from "../../context/I18nContext";
import { useAuth } from "../../context/AuthContext";
import { SchemeCard } from "./SchemeCard";
import { WhatToConfirmModal } from "./WhatToConfirmModal";
import { AudioReadButton } from "../common/AudioReadButton";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle,
  HelpCircle,
  AlertCircle,
  FileText,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Bookmark,
  RefreshCw,
  ExternalLink,
  User,
  ShieldCheck,
  Sun,
  Sparkles,
} from "lucide-react";
import type { MemberSchemeResult } from "../../api/types";

export const ResultsView: React.FC = () => {
  const { evaluation, isLoading, reevaluate, setAnswer, householdId } = useHousehold();
  const { user, isAuthenticated } = useAuth();
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  const [filterLevel, setFilterLevel] = useState<"all" | "central" | "state">("all");
  const [activeTab, setActiveTab] = useState<"all" | "can_apply" | "likely_confirm">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showExplore, setShowExplore] = useState(false);
  const [showNotEligible, setShowNotEligible] = useState(false);
  const [selectedSchemeForConfirm, setSelectedSchemeForConfirm] = useState<MemberSchemeResult | null>(null);

  useEffect(() => {
    if (!evaluation && !isLoading) {
      reevaluate(showExplore);
    }
  }, [evaluation, isLoading, reevaluate, showExplore]);

  const handleToggleExplore = () => {
    const nextVal = !showExplore;
    setShowExplore(nextVal);
    reevaluate(nextVal);
  };

  const memberResult = evaluation?.results?.[0];

  const canApplyList = memberResult?.tiers?.can_apply || [];
  const likelyConfirmList = memberResult?.tiers?.likely_confirm || [];
  const notEligibleList = memberResult?.tiers?.not_eligible || [];
  const exploreList = memberResult?.tiers?.explore || [];

  const filterList = (list: MemberSchemeResult[]) => {
    let res = list;
    if (filterLevel === "central") {
      res = res.filter((s) => s.scheme_id.startsWith("CENT-"));
    } else if (filterLevel === "state") {
      res = res.filter((s) => !s.scheme_id.startsWith("CENT-"));
    }
    if (!searchQuery.trim()) return res;
    const q = searchQuery.toLowerCase();
    return res.filter(
      (s) =>
        s.official_name.toLowerCase().includes(q) ||
        s.scheme_id.toLowerCase().includes(q) ||
        s.reasons.en.some((r) => r.toLowerCase().includes(q))
    );
  };

  const filteredCanApply = filterList(canApplyList);
  const filteredLikelyConfirm = filterList(likelyConfirmList);
  const filteredNotEligible = filterList(notEligibleList);
  const filteredExplore = filterList(exploreList);

  const audioSummary = `${t("evaluation_summary_audio")}: ${canApplyList.length} ${t("can_apply_title")}, ${likelyConfirmList.length} ${t("likely_confirm_title")}. ${t("screening_disclaimer_short")}`;

  return (
    <div className="mx-auto max-w-4xl px-2 sm:px-4 py-4 text-[#2D231E]">
      {/* Disclaimer Banner (Required by tests) */}
      <div className="mb-4 rounded-2xl border border-amber-300 bg-[#FDF4E7] p-3.5 shadow-xs">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#C4714A]" />
          <div className="flex-1">
            <h2 className="text-xs font-bold text-[#944C2B]">
              {t("screening_tool_notice_title")}
            </h2>
            <p className="mt-0.5 text-[11px] text-[#B05E38] leading-relaxed">
              {t("screening_tool_notice_desc")}
            </p>
          </div>
          <AudioReadButton text={t("screening_tool_notice_desc")} size="sm" />
        </div>
      </div>

      {/* 3_Schemes.png Header: Title & Search */}
      <div className="space-y-3 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#2D231E] tracking-tight">
              {language === "mr" ? "योजना (Schemes)" : "Schemes"}
            </h1>
            <p className="text-xs text-[#6B5E55] font-semibold mt-0.5">
              {canApplyList.length + likelyConfirmList.length} {language === "mr" ? "शिफारस केलेल्या योजना उपलब्ध" : "recommended schemes available"}
            </p>
          </div>
          <AudioReadButton text={audioSummary} />
        </div>

        {/* Search Input matching 3_Schemes.png */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8C7E74]">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === "mr"
                ? "योजना किंवा लाभाचे नाव शोधा (उदा. पेन्शन, शेतकरी, आरोग्य)..."
                : "Search schemes, pensions, healthcare, farming..."
            }
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[#E8DFD5] bg-white text-[#2D231E] placeholder:text-[#8C7E74] text-xs sm:text-sm font-semibold focus:border-[#C4714A] focus:ring-1 focus:ring-[#C4714A] shadow-xs"
          />
        </div>

        {/* Filter Pills matching 3_Schemes.png */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setFilterLevel("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap flex-shrink-0 ${
              filterLevel === "all"
                ? "bg-[#C4714A] text-white shadow-xs"
                : "bg-white text-[#6B5E55] border border-[#E8DFD5] hover:border-[#C4714A]"
            }`}
          >
            All ({canApplyList.length + likelyConfirmList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterLevel("central")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap flex-shrink-0 ${
              filterLevel === "central"
                ? "bg-[#C4714A] text-white shadow-xs"
                : "bg-white text-[#6B5E55] border border-[#E8DFD5] hover:border-[#C4714A]"
            }`}
          >
            Central (केंद्री)
          </button>
          <button
            type="button"
            onClick={() => setFilterLevel("state")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap flex-shrink-0 ${
              filterLevel === "state"
                ? "bg-[#C4714A] text-white shadow-xs"
                : "bg-white text-[#6B5E55] border border-[#E8DFD5] hover:border-[#C4714A]"
            }`}
          >
            State (महाराष्ट्र)
          </button>

          {/* Quick Action links */}
          <Link
            to="/document-plan"
            className="sm:ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E8DFD5] text-[#2D231E] hover:border-[#4F7B55] text-xs font-bold shadow-xs whitespace-nowrap flex-shrink-0"
          >
            <FileText className="w-3.5 h-3.5 text-[#4F7B55]" />
            <span>{t("nav.document_plan")} →</span>
          </Link>
        </div>
      </div>

      {/* 3_Schemes.png: Recommended for You Section */}
      <div className="mt-4 space-y-6">
        {/* Tier 1: CAN APPLY */}
        <section aria-labelledby="tier-can-apply" className="space-y-3">
          <div className="flex items-center justify-between border-b border-[#E8DFD5] pb-2">
            <h2 id="tier-can-apply" className="text-base sm:text-lg font-black text-[#2D231E] flex items-center gap-2">
              <Sun className="w-5 h-5 text-[#C4714A]" />
              <span>{t("can_apply_title")}</span>
              <span className="text-xs font-bold text-[#4F7B55] bg-[#EBF2EC] px-2.5 py-0.5 rounded-full border border-[#CADBCB]">
                {filteredCanApply.length}
              </span>
            </h2>
            <span className="text-xs text-[#6B5E55] font-medium hidden sm:inline">
              {t("can_apply_subtitle")}
            </span>
          </div>

          {filteredCanApply.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredCanApply.map((scheme) => (
                <SchemeCard key={scheme.scheme_id} scheme={scheme} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#E8DFD5] bg-white p-6 text-center text-xs text-[#6B5E55]">
              {language === "mr"
                ? "या वर्गात सध्या कोणतीही योजना आढळली नाही. प्रोफाइलमधील माहिती तपासा."
                : "No schemes match the criteria in this category."}
            </div>
          )}
        </section>

        {/* Tier 2: LIKELY CONFIRM */}
        <section aria-labelledby="tier-likely-confirm" className="space-y-3 pt-4">
          <div className="flex items-center justify-between border-b border-[#E8DFD5] pb-2">
            <h2 id="tier-likely-confirm" className="text-base sm:text-lg font-black text-[#2D231E] flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#C4714A]" />
              <span>{t("likely_confirm_title")}</span>
              <span className="text-xs font-bold text-[#C4714A] bg-[#FDF4E7] px-2.5 py-0.5 rounded-full border border-[#F4DEC3]">
                {filteredLikelyConfirm.length}
              </span>
            </h2>
            <span className="text-xs text-[#6B5E55] font-medium hidden sm:inline">
              {t("likely_confirm_subtitle")}
            </span>
          </div>

          {filteredLikelyConfirm.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {filteredLikelyConfirm.map((scheme) => (
                <SchemeCard
                  key={scheme.scheme_id}
                  scheme={scheme}
                  onOpenWhatToConfirm={(sc) => setSelectedSchemeForConfirm(sc)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Tier 3: NOT ELIGIBLE (Collapsed by default, required by smoke test) */}
        <section aria-labelledby="tier-not-eligible" className="space-y-3 pt-4 border-t border-[#E8DFD5]">
          <div className="flex items-center justify-between">
            <button
              type="button"
              data-testid="toggle-not-eligible-btn"
              onClick={() => setShowNotEligible(!showNotEligible)}
              className="flex items-center gap-2 text-sm sm:text-base font-black text-[#2D231E] hover:text-[#C4714A] transition-colors p-1"
            >
              <AlertCircle className="w-5 h-5 text-slate-500" />
              <span>{language === "mr" ? "पात्र नसलेल्या योजना (Not eligible)" : "Not Eligible Schemes"}</span>
              <span className="text-xs font-bold text-[#6B5E55] bg-white px-2 py-0.5 rounded-full border border-[#E8DFD5]">
                {filteredNotEligible.length}
              </span>
              {showNotEligible ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </button>
          </div>

          {showNotEligible && (
            <div data-testid="not-eligible-container" className="grid grid-cols-1 gap-4 pt-2">
              {filteredNotEligible.map((scheme) => (
                <SchemeCard key={scheme.scheme_id} scheme={scheme} />
              ))}
            </div>
          )}
        </section>

        {/* Tier 4: EXPLORE (Hidden by default, required by smoke test) */}
        <section aria-labelledby="tier-explore" className="space-y-3 pt-4 border-t border-[#E8DFD5]">
          <div className="flex items-center justify-between">
            <button
              type="button"
              data-testid="toggle-explore-btn"
              onClick={handleToggleExplore}
              className="flex items-center gap-2 text-sm sm:text-base font-black text-[#2D231E] hover:text-[#C4714A] transition-colors p-1"
            >
              <Sparkles className="w-5 h-5 text-[#C4714A]" />
              <span>{language === "mr" ? "इतर योजना एक्सप्लोर करा (Explore)" : "Explore Other Schemes"}</span>
              <span className="text-xs font-bold text-[#C4714A] bg-[#FDF4E7] px-2 py-0.5 rounded-full border border-[#F4DEC3]">
                {filteredExplore.length}
              </span>
              {showExplore ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </button>
          </div>

          {showExplore && (
            <div data-testid="explore-container" className="grid grid-cols-1 gap-4 pt-2">
              {filteredExplore.map((scheme) => (
                <SchemeCard key={scheme.scheme_id} scheme={scheme} />
              ))}
            </div>
          )}
        </section>

        {/* What to confirm modal */}
        {selectedSchemeForConfirm && (
          <WhatToConfirmModal
            scheme={selectedSchemeForConfirm}
            onClose={() => setSelectedSchemeForConfirm(null)}
            onAnswerSaved={async (key: string, val: unknown) => {
              await setAnswer(key, val);
              reevaluate(showExplore);
            }}
          />
        )}
      </div>
    </div>
  );
};
