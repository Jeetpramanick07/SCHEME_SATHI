import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../../context/I18nContext";
import { ShieldCheck, Users, BarChart3, HelpCircle, Lock, Mail, Activity } from "lucide-react";

export const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer className="w-full bg-[#F5EFE6] border-t border-[#E8DFD5] mt-12 py-8 px-4 text-[#6B5E55] text-xs">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Core Government Screening Notice */}
        <div className="bg-white p-4 rounded-2xl border border-[#E8DFD5] flex items-start gap-3 shadow-xs">
          <ShieldCheck className="w-5 h-5 text-[#C4714A] flex-shrink-0 mt-0.5" />
          <div className="text-[#2D231E] leading-relaxed text-xs">
            <span className="font-bold text-[#2D231E] block mb-0.5">
              महत्त्वाची सूचना / Important Advisory:
            </span>
            {t("app.screening_notice")}
          </div>
        </div>

        {/* Footer Navigation Columns */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#E8DFD5]">
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <Link to="/faqs" className="flex items-center gap-1 text-[#6B5E55] hover:text-[#C4714A] transition-colors">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{t("nav.faqs")}</span>
            </Link>
            <Link to="/volunteer" className="flex items-center gap-1 text-[#6B5E55] hover:text-[#C4714A] transition-colors">
              <Users className="w-3.5 h-3.5" />
              <span>{t("nav.volunteer")}</span>
            </Link>
            <Link to="/ngo" className="flex items-center gap-1 text-[#6B5E55] hover:text-[#4F7B55] transition-colors">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{t("nav.ngo")}</span>
            </Link>
            <Link to="/settings" className="flex items-center gap-1 text-[#6B5E55] hover:text-[#C4714A] transition-colors">
              <Lock className="w-3.5 h-3.5" />
              <span>{t("nav.settings")}</span>
            </Link>
            <Link to="/inbox" className="flex items-center gap-1 text-[#6B5E55] hover:text-[#C4714A] transition-colors">
              <Mail className="w-3.5 h-3.5" />
              <span>SMS Inbox</span>
            </Link>
            <Link to="/diagnostics" className="flex items-center gap-1 text-[#6B5E55] hover:text-[#C4714A] transition-colors">
              <Activity className="w-3.5 h-3.5" />
              <span>{t("nav.diagnostics") || "Diagnostics"}</span>
            </Link>
          </div>

          <p className="text-[#8C7E74] text-[11px] font-medium">
            Sarkari Sahayak • SchemeSaathi • Orange & Peach Public Welfare Portal
          </p>
        </div>
      </div>
    </footer>
  );
};
