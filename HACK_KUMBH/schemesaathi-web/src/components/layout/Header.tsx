import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "../../context/I18nContext";
import { useHousehold } from "../../context/HouseholdContext";
import { useAuth } from "../../context/AuthContext";
import { AccessibilityBar } from "../common/AccessibilityBar";
import { OfflineBanner } from "../common/OfflineBanner";
import { LoginRegisterModal } from "../auth/LoginRegisterModal";
import {
  ShieldAlert,
  LogOut,
  CheckCircle2,
  User,
  BarChart3,
  Bell,
  Settings,
} from "lucide-react";

export const Header: React.FC = () => {
  const { t, language } = useTranslation();
  const { householdId } = useHousehold();
  const { role, logoutVolunteer, logoutAdmin, user, isAuthenticated, logoutCitizen } = useAuth();
  const location = useLocation();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const isVolunteer = role === "volunteer";
  const isAdmin = role === "admin";

  return (
    <header className="w-full sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md shadow-xs border-b border-[#E8DFD5]">
      {/* Accessibility Toolbar */}
      <AccessibilityBar />

      {/* Offline Alert Banner */}
      <OfflineBanner />

      {/* Volunteer Assisted Mode Banner */}
      {isVolunteer && (
        <div className="bg-[#C4714A] text-white px-3 sm:px-4 py-1.5 text-xs font-bold shadow-xs">
          <div className="flex items-center justify-between max-w-6xl mx-auto w-full gap-2">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <ShieldAlert className="w-4 h-4 text-orange-200 flex-shrink-0" />
              <span className="truncate">{t("volunteer.banner")}</span>
              {householdId && (
                <span className="bg-[#944C2B] text-orange-100 px-2 py-0.5 rounded text-[11px] font-mono flex-shrink-0">
                  HH: {householdId}
                </span>
              )}
            </div>
            <button
              onClick={logoutVolunteer}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#753B21] hover:bg-[#5A2D19] rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex-shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t("volunteer.logout")}</span>
            </button>
          </div>
        </div>
      )}

      {/* NGO Admin Banner */}
      {isAdmin && (
        <div className="bg-[#4F7B55] text-white px-3 sm:px-4 py-1.5 text-xs font-bold shadow-xs">
          <div className="flex items-center justify-between max-w-6xl mx-auto w-full gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-200 flex-shrink-0" />
              <span className="font-black tracking-wide truncate hidden sm:inline">
                ADMIN / NGO GOVERNANCE & ANALYTICS MODE
              </span>
              <span className="font-black tracking-wide sm:hidden truncate">
                ADMIN / NGO MODE
              </span>
            </div>
            <button
              onClick={logoutAdmin}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#324F36] hover:bg-[#273E2B] rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex-shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit Admin</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Header Bar */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-3">
        {/* Brand Logo & Title with Official Scheme Sathi Emblem */}
        <Link to="/" className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 group">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl overflow-hidden shadow-xs border border-[#DECFC0] bg-[#FAF7F2] flex items-center justify-center flex-shrink-0">
            <img
              src="/logo.jpg"
              alt="Scheme Sathi Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="text-base sm:text-lg font-black tracking-tight leading-none text-[#2D231E] whitespace-nowrap group-hover:text-[#C4714A] transition-colors">
                Scheme <span className="text-[#4F7B55]">Sathi</span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-[#C4714A] bg-[#C4714A]/10 px-1.5 py-0.5 rounded-full border border-[#C4714A]/20 whitespace-nowrap">
                Sarkari Sahayak
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#6B5E55] font-semibold mt-0.5 hidden md:block whitespace-nowrap">
              {language === "mr"
                ? "प्रत्येक नागरिकासाठी केंद्रीय व राज्य योजना"
                : language === "hi"
                ? "प्रत्येक नागरिक के लिए केंद्रीय व राज्य योजनाएं"
                : "Central & State Schemes for Every Citizen"}
            </p>
          </div>
        </Link>

        {/* Navigation Links + User Actions */}
        <nav className="flex items-center gap-1 sm:gap-2.5 flex-shrink-0">
          {/* Desktop Navigation Links */}
          <Link
            to="/results"
            className={`hidden md:inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-shrink-0 ${
              location.pathname === "/results"
                ? "bg-[#C4714A] text-white shadow-xs"
                : "text-[#2D231E] hover:bg-[#EFE8DF]"
            }`}
          >
            {t("nav.schemes")}
          </Link>

          <Link
            to="/document-plan"
            className={`hidden lg:inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-shrink-0 ${
              location.pathname === "/document-plan"
                ? "bg-[#C4714A] text-white shadow-xs"
                : "text-[#2D231E] hover:bg-[#EFE8DF]"
            }`}
          >
            {t("nav.document_plan")}
          </Link>

          <Link
            to="/applications"
            className={`hidden md:inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-shrink-0 ${
              location.pathname === "/applications"
                ? "bg-[#C4714A] text-white shadow-xs"
                : "text-[#2D231E] hover:bg-[#EFE8DF]"
            }`}
          >
            {language === "mr" ? "अर्ज स्थिती" : language === "hi" ? "आवेदन स्थिति" : "Applications"}
          </Link>

          {/* Dedicated NGO / Governance Portal Button */}
          <Link
            to={isAdmin ? "/ngo" : "/ngo/login"}
            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all border whitespace-nowrap flex-shrink-0 ${
              location.pathname.startsWith("/ngo")
                ? "bg-[#4F7B55] text-white border-[#4F7B55] shadow-xs"
                : "bg-[#EBF2EC] text-[#4F7B55] border-[#CADBCB] hover:bg-[#CADBCB]/40"
            }`}
            title="NGO & Governance Analytics Portal"
          >
            <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {language === "mr" ? "NGO विश्लेषण" : language === "hi" ? "NGO विश्लेषण" : "NGO Portal"}
            </span>
          </Link>

          {/* Notification / SMS Inbox Bell Icon */}
          <Link
            to="/inbox"
            className="relative p-2 rounded-xl text-[#6B5E55] hover:text-[#2D231E] hover:bg-[#EFE8DF] transition-colors flex-shrink-0"
            title="Simulated SMS Notifications & Reminders"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#C4714A] ring-2 ring-white" />
          </Link>

          {/* PROMINENT USER PROFILE ICON / BUTTON */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Link
                to="/profile"
                data-testid="profile-icon"
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all border-2 shadow-xs whitespace-nowrap flex-shrink-0 ${
                  location.pathname === "/profile"
                    ? "bg-[#C4714A] text-white border-[#C4714A] shadow-md ring-2 ring-[#C4714A]/20"
                    : "bg-[#FFFFFF] text-[#2D231E] border-[#E8DFD5] hover:border-[#C4714A]"
                }`}
                title="माझे प्रोफाइल (My Profile)"
              >
                <div className="w-6 h-6 rounded-full bg-[#C4714A] text-white flex items-center justify-center text-xs font-black shadow-inner flex-shrink-0">
                  {user.full_name ? user.full_name.charAt(0).toUpperCase() : "👤"}
                </div>
                <span className="hidden sm:inline max-w-[110px] truncate">
                  {user.full_name || user.username}
                </span>
                <span className="sm:hidden text-xs font-bold">
                  {language === "mr" ? "प्रोफाइल" : "Profile"}
                </span>
                {user.profile_completed ? (
                  <span className="w-2 h-2 rounded-full bg-[#4F7B55] ring-2 ring-white flex-shrink-0" title="Profile Complete" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-[#C4714A] ring-2 ring-white animate-pulse flex-shrink-0" title="Profile Incomplete" />
                )}
              </Link>
              <button
                onClick={logoutCitizen}
                className="p-1.5 text-[#6B5E55] hover:text-[#2D231E] rounded-lg hover:bg-[#EFE8DF] transition-colors flex-shrink-0"
                title="लॉगआउट (Logout)"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              data-testid="profile-icon"
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-[#C4714A] hover:bg-[#B05E38] text-white font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 border border-[#B05E38] whitespace-nowrap flex-shrink-0"
              title="लॉगिन करा किंवा प्रोफाइल उघडा"
            >
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="hidden sm:inline">
                {language === "mr" ? "लॉगिन / प्रोफाइल" : language === "hi" ? "लॉगिन / प्रोफाइल" : "Login / Profile"}
              </span>
              <span className="sm:hidden font-bold">
                {language === "mr" ? "लॉगिन" : language === "hi" ? "लॉगिन" : "Login"}
              </span>
            </button>
          )}

          {/* Privacy & Settings Gear */}
          <Link
            to="/settings"
            className="p-1.5 rounded-xl text-[#6B5E55] hover:text-[#2D231E] hover:bg-[#EFE8DF] transition-colors flex-shrink-0"
            title="Privacy & Data Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </nav>
      </div>

      <LoginRegisterModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </header>
  );
};
