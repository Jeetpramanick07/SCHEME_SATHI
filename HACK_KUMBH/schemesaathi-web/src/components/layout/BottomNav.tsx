import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "../../context/I18nContext";
import { useAuth } from "../../context/AuthContext";
import {
  Home,
  Landmark,
  FileText,
  Search,
  User,
} from "lucide-react";

interface BottomNavProps {
  onOpenAuthModal?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenAuthModal }) => {
  const location = useLocation();
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();

  const navItems = [
    {
      to: "/",
      label: language === "mr" ? "मुख्यपृष्ठ" : language === "hi" ? "होम" : "Home",
      icon: Home,
      isActive: location.pathname === "/",
    },
    {
      to: "/results",
      label: language === "mr" ? "योजना" : language === "hi" ? "योजनाएं" : "Schemes",
      icon: Landmark,
      isActive: location.pathname === "/results",
    },
    {
      to: "/document-plan",
      label: language === "mr" ? "कागदपत्रे" : language === "hi" ? "दस्तावेज़" : "Documents",
      icon: FileText,
      isActive: location.pathname === "/document-plan",
    },
    {
      to: "/applications",
      label: language === "mr" ? "अर्जाचा मागोवा" : language === "hi" ? "ट्रैक करें" : "Track",
      icon: Search,
      isActive: location.pathname.startsWith("/applications"),
    },
    {
      to: isAuthenticated ? "/profile" : "#",
      label: language === "mr" ? "प्रोफाइल" : language === "hi" ? "प्रोफाइल" : "Profile",
      icon: User,
      isActive: location.pathname === "/profile",
      onClick: !isAuthenticated ? onOpenAuthModal : undefined,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-t border-[#E8DFD5] shadow-lg md:hidden"
    >
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1">
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const active = item.isActive;

          if (item.onClick) {
            return (
              <button
                key={idx}
                type="button"
                onClick={item.onClick}
                className={`flex flex-col items-center justify-center gap-1 transition-all ${
                  active ? "text-[#C4714A]" : "text-[#6B5E55] hover:text-[#C4714A]"
                }`}
              >
                <div
                  className={`p-1 rounded-xl transition-all ${
                    active ? "bg-[#C4714A]/10 text-[#C4714A] scale-110" : ""
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-[10px] font-bold tracking-tight truncate max-w-[64px] ${
                    active ? "text-[#C4714A] font-black" : "text-[#6B5E55]"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={idx}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-1 transition-all ${
                active ? "text-[#C4714A]" : "text-[#6B5E55] hover:text-[#C4714A]"
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  active ? "bg-[#C4714A]/10 text-[#C4714A] scale-110" : ""
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={`text-[10px] font-bold tracking-tight truncate max-w-[64px] ${
                  active ? "text-[#C4714A] font-black" : "text-[#6B5E55]"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
