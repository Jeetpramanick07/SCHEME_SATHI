import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "../../context/I18nContext";
import { useHousehold } from "../../context/HouseholdContext";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import { AudioReadButton } from "../common/AudioReadButton";
import { DemoBadge } from "../common/DemoBadge";
import { LoginRegisterModal } from "../auth/LoginRegisterModal";
import {
  FileText,
  QrCode,
  Edit3,
  ArrowRight,
  CheckCircle2,
  Loader2,
  UserCheck,
  LogIn,
  AlertCircle,
  User,
  Sparkles,
  Search,
  BookOpen,
  MapPin,
  Building2,
} from "lucide-react";
import { Language } from "../../api/types";

export const StartScreen: React.FC = () => {
  const { language, setLanguage, t } = useTranslation();
  const { setBatchAnswers, setPrefillSource, setDistrictId, setTaluka } = useHousehold();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [isLoadingPrefill, setIsLoadingPrefill] = useState<"digilocker" | "aadhaar_qr" | null>(null);
  const [prefillFeedback, setPrefillFeedback] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<"login" | "register">("login");

  const langs: Array<{ code: Language; label: string; desc: string }> = [
    { code: "mr", label: "मराठी", desc: "विदर्भासाठी मुख्य भाषा" },
    { code: "hi", label: "हिन्दी", desc: "सरल भाषा में" },
    { code: "en", label: "English", desc: "Standard English" },
  ];

  const handleSimulatePrefill = async (type: "digilocker" | "aadhaar_qr") => {
    setIsLoadingPrefill(type);
    try {
      const res =
        type === "digilocker"
          ? await api.simulateDigiLocker()
          : await api.simulateAadhaarQr();

      const { age, gender, district } = res.attributes;

      const newAnswers: Record<string, unknown> = {};
      if (age) newAnswers.age = age;
      if (gender) newAnswers.gender = gender;
      if (district) {
        newAnswers.district = district;
        setDistrictId("DIST_MH_NGP");
        setTaluka("Nagpur Urban");
      }

      await setBatchAnswers(newAnswers);
      setPrefillSource(type);

      setPrefillFeedback(
        t("start.prefill_success", {
          age: String(age || "62"),
          gender: String(gender || "FEMALE"),
          district: String(district || "Nagpur"),
        })
      );

      setTimeout(() => {
        navigate("/questionnaire");
      }, 900);
    } catch {
      navigate("/questionnaire");
    } finally {
      setIsLoadingPrefill(null);
    }
  };

  const handleManualStart = () => {
    setPrefillSource("manual");
    navigate("/questionnaire");
  };

  const welcomeText = `${t("start.welcome_title")}. ${t("start.welcome_subtitle")}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2 px-2 sm:px-4 text-[#2D231E]">
      {/* 2_Home.png Top Greeting Card with Official Logo */}
      <div className="flex items-center justify-between bg-white rounded-3xl p-4 sm:p-5 border border-[#E8DFD5] shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shadow-xs border border-[#DECFC0] bg-[#FAF7F2] flex items-center justify-center flex-shrink-0">
            <img src="/logo.jpg" alt="Scheme Sathi" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-[#2D231E] tracking-tight">
                Scheme <span className="text-[#4F7B55]">Sathi</span>
              </h2>
              <AudioReadButton text={welcomeText} autoPlay={false} size="sm" />
            </div>
            <p className="text-xs sm:text-sm text-[#6B5E55] font-semibold mt-0.5">
              {language === "mr"
                ? "नमस्कार! तुमच्यासाठी योग्य योजना, आता अधिक सोपी!"
                : language === "hi"
                ? "नमस्ते! आपके लिए सही योजना, अब और आसान!"
                : "Namaste! Finding the right government schemes made simple!"}
            </p>
          </div>
        </div>
      </div>

      {/* 2_Home.png HERO CARD: Solid Green #4F7B55 Check Eligibility */}
      <div
        onClick={handleManualStart}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleManualStart(); }}
        className="group relative cursor-pointer overflow-hidden rounded-3xl bg-[#4F7B55] hover:bg-[#3F6444] p-6 text-white shadow-lg transition-all active:scale-[0.99] border border-[#3F6444]"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-[#4F7B55] shadow-md flex-shrink-0">
              <CheckCircle2 className="w-8 h-8 text-[#4F7B55]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-none">
                  {language === "mr" ? "पात्रता तपासा" : language === "hi" ? "पात्रता जांचें" : "Check Eligibility"}
                </h3>
                <span className="text-[10px] bg-white/20 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  AI Screener
                </span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-100 font-medium mt-1">
                {language === "mr"
                  ? "तुमच्या कुटुंबासाठी योग्य योजना शोधा"
                  : language === "hi"
                  ? "अपने परिवार के लिए उपयुक्त योजनाएं खोजें"
                  : "Find suitable government schemes for you"}
              </p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 group-hover:bg-white text-white group-hover:text-[#4F7B55] flex items-center justify-center transition-all flex-shrink-0">
            <ArrowRight className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2_Home.png QUICK ACCESS 2x2 Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-[#6B5E55] uppercase tracking-wider px-1">
          {language === "mr" ? "त्वरित प्रवेश" : language === "hi" ? "त्वरित पहुंच" : "Quick Access"}
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* 1. Documents Checklist */}
          <Link
            to="/document-plan"
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-[#E8DFD5] hover:border-[#C4714A] hover:bg-[#FAF7F2] shadow-xs transition-all text-center group"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#F6ECE4] text-[#C4714A] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <FileText className="w-6 h-6" />
            </div>
            <span className="text-xs sm:text-sm font-black text-[#2D231E]">
              {language === "mr" ? "कागदपत्र यादी" : language === "hi" ? "दस्तावेज़ चेकलिस्ट" : "Documents Checklist"}
            </span>
            <span className="text-[10px] text-[#6B5E55] mt-0.5">
              {language === "mr" ? "Smart DAG क्रम" : "Smart DAG Plan"}
            </span>
          </Link>

          {/* 2. Application Guide */}
          <Link
            to="/applications"
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-[#E8DFD5] hover:border-[#4F7B55] hover:bg-[#FAF7F2] shadow-xs transition-all text-center group"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#EBF2EC] text-[#4F7B55] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="text-xs sm:text-sm font-black text-[#2D231E]">
              {language === "mr" ? "अर्ज मार्गदर्शक" : language === "hi" ? "आवेदन गाइड" : "Application Guide"}
            </span>
            <span className="text-[10px] text-[#6B5E55] mt-0.5">
              {language === "mr" ? "ऑनलाइन व सेतू केंद्र" : "Online & Setu Kendra"}
            </span>
          </Link>

          {/* 3. Track Application */}
          <Link
            to="/applications"
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-[#E8DFD5] hover:border-[#C4714A] hover:bg-[#FAF7F2] shadow-xs transition-all text-center group"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#F6ECE4] text-[#C4714A] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Search className="w-6 h-6" />
            </div>
            <span className="text-xs sm:text-sm font-black text-[#2D231E]">
              {language === "mr" ? "अर्जाचा मागोवा" : language === "hi" ? "आवेदन ट्रैक करें" : "Track Application"}
            </span>
            <span className="text-[10px] text-[#6B5E55] mt-0.5">
              {language === "mr" ? "रिअल-टाइम स्थिती" : "Status & SMS updates"}
            </span>
          </Link>

          {/* 4. Help Centres */}
          <Link
            to="/help-centres"
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-[#E8DFD5] hover:border-[#C4714A] hover:bg-[#FAF7F2] shadow-xs transition-all text-center group"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#F6ECE4] text-[#C4714A] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <MapPin className="w-6 h-6" />
            </div>
            <span className="text-xs sm:text-sm font-black text-[#2D231E]">
              {language === "mr" ? "मदत केंद्रे" : language === "hi" ? "सहायता केंद्र" : "Help Centres"}
            </span>
            <span className="text-[10px] text-[#6B5E55] mt-0.5">
              {language === "mr" ? "जवळचे सेतू सुविधा केंद्र" : "Nearest Seva Kendras"}
            </span>
          </Link>
        </div>
      </div>

      {/* 2_Home.png PROMO BANNER */}
      <Link
        to="/results"
        className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-[#F6ECE4] to-[#FAF7F2] border border-[#E8DFD5] hover:border-[#C4714A] shadow-xs transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white text-[#C4714A] flex items-center justify-center shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-[#2D231E] group-hover:text-[#C4714A] transition-colors">
              {language === "mr"
                ? "सरकारी योजनांचा लाभ घ्या!"
                : language === "hi"
                ? "सरकारी योजनाओं का लाभ उठाएं!"
                : "Explore 738+ Central & Maharashtra Schemes!"}
            </h4>
            <p className="text-[11px] text-[#6B5E55] font-medium">
              {language === "mr" ? "सर्व योजनांची माहिती एकाच ठिकाणी" : "Verified benefits for health, pensions & farming"}
            </p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-[#C4714A] group-hover:translate-x-1 transition-transform" />
      </Link>

      {/* Language Buttons: Big Tap Targets */}
      <div className="space-y-2 pt-2">
        <h3 className="text-xs font-black text-[#6B5E55] uppercase tracking-wider text-center">
          {t("language.select")}
        </h3>
        <div className="grid grid-cols-3 gap-2.5">
          {langs.map((l) => (
            <button
              key={l.code}
              onClick={() => setLanguage(l.code)}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all min-h-[56px] ${
                language === l.code
                  ? "border-[#C4714A] bg-[#F6ECE4] text-[#2D231E] shadow-sm ring-2 ring-[#C4714A]/20 scale-[1.01]"
                  : "border-[#E8DFD5] bg-white text-[#6B5E55] hover:border-[#C4714A] hover:bg-[#FAF7F2]"
              }`}
            >
              <span className="text-base sm:text-xl font-black">{l.label}</span>
              <span className="text-[10px] font-semibold text-[#8C7E74] mt-0.5">{l.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* USER ACCOUNT & PROFILE REMINDER CARDS */}
      {!isAuthenticated ? (
        <div className="bg-white border-2 border-[#E8DFD5] rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#C4714A] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-[#2D231E]">
                {language === "mr"
                  ? "नवीन किंवा अस्तित्वातील वापरकर्ता?"
                  : language === "hi"
                  ? "नया या मौजूदा उपयोगकर्ता?"
                  : "New or Existing Citizen User?"}
              </h3>
              <p className="text-xs text-[#6B5E55] font-medium mt-0.5 leading-relaxed">
                {language === "mr"
                  ? "आपल्या वैयक्तिक योजना व अर्जांचे व्यवस्थापन करण्यासाठी स्वतंत्र खात्यात लॉगिन किंवा नोंदणी करा."
                  : language === "hi"
                  ? "अपनी व्यक्तिगत योजनाओं और दावों का प्रबंधन करने के लिए अलग खाते में लॉगिन या पंजीकरण करें।"
                  : "Login or register to access your separate citizen account and track personalized welfare schemes."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setAuthModalTab("login");
                setAuthModalOpen(true);
              }}
              className="min-h-[46px] py-2.5 px-4 rounded-xl bg-[#C4714A] hover:bg-[#B05E38] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>{language === "mr" ? "लॉगिन करा" : language === "hi" ? "लॉगिन करें" : "Login"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthModalTab("register");
                setAuthModalOpen(true);
              }}
              className="min-h-[46px] py-2.5 px-4 rounded-xl bg-white hover:bg-[#FAF7F2] text-[#C4714A] border-2 border-[#C4714A] font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-95"
            >
              <UserCheck className="w-4 h-4" />
              <span>{language === "mr" ? "नवीन नोंदणी" : language === "hi" ? "नया खाता" : "Register"}</span>
            </button>
          </div>
        </div>
      ) : !user?.profile_completed ? (
        /* Authenticated but Profile Incomplete Reminder */
        <div className="bg-[#FBF6F2] border-2 border-[#C4714A]/40 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#C4714A] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <h3 className="text-sm sm:text-base font-black text-[#2D231E]">
                  {language === "mr"
                    ? `स्वागत आहे, ${user?.full_name || user?.username}! प्रोफाइल पूर्ण करा`
                    : language === "hi"
                    ? `स्वागत है, ${user?.full_name || user?.username}! प्रोफाइल पूरा करें`
                    : `Welcome, ${user?.full_name || user?.username}! Complete your profile`}
                </h3>
                <span className="text-[11px] font-black text-[#C4714A] bg-[#F6ECE4] px-2.5 py-0.5 rounded-full border border-[#C4714A]/30">
                  स्मरणपत्र (Reminder)
                </span>
              </div>
              <p className="text-xs text-[#6B5E55] font-medium mt-1 leading-relaxed">
                {language === "mr"
                  ? "तुमचे प्रोफाइल अपूर्ण आहे. अचूक व १००% पात्र शासकीय योजना पाहण्यासाठी कृपया प्रोफाइल डॅशबोर्डमध्ये माहिती भरा (डिजीलॉकर किंवा मॅन्युअल)."
                  : language === "hi"
                  ? "आपकी प्रोफाइल अधूरी है। सटीक योजनाएं देखने के लिए प्रोफाइल विवरण भरें।"
                  : "Your profile is incomplete. Please complete your profile details (DigiLocker, Aadhaar, Land & Income) to unlock all eligible schemes."}
              </p>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-[#C4714A] hover:bg-[#B05E38] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {language === "mr"
                  ? "प्रोफाइल डॅशबोर्ड उघडा व पूर्ण करा →"
                  : language === "hi"
                  ? "प्रोफाइल डैशबोर्ड खोलें और पूरा करें →"
                  : "Open Profile Dashboard & Complete →"}
              </span>
            </button>
          </div>
        </div>
      ) : (
        /* Profile Completed Banner */
        <div className="bg-[#EBF2EC] border-2 border-[#CADBCB] rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#4F7B55] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-[#2D231E]">
                {language === "mr"
                  ? `प्रोफाइल पूर्ण झाले आहे! (${user?.full_name || user?.username})`
                  : `Profile Completed! (${user?.full_name || user?.username})`}
              </h3>
              <p className="text-xs text-[#4F7B55] font-medium">
                {language === "mr" ? "तुमच्या माहितीनुसार पात्र योजना तयार आहेत." : "Personalized schemes ready based on your profile."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="px-3.5 py-2 rounded-xl border border-[#4F7B55] bg-white text-[#4F7B55] font-bold text-xs"
            >
              {language === "mr" ? "प्रोफाइल पहा" : "View Profile"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/results")}
              className="px-4 py-2 rounded-xl bg-[#4F7B55] hover:bg-[#3F6444] text-white font-black text-xs flex items-center gap-1.5 shadow-xs"
            >
              <span>{language === "mr" ? "योग्य योजना पहा" : "See Schemes"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Entry Options: Minimum 56px Tap Targets */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-black text-[#6B5E55] uppercase tracking-wider text-center">
          {t("start.choose_entry")}
        </h3>

        <div className="space-y-2.5">
          {/* 1. DigiLocker Option */}
          <button
            onClick={() => handleSimulatePrefill("digilocker")}
            disabled={isLoadingPrefill !== null}
            className="w-full text-left p-4 rounded-2xl border border-[#E8DFD5] hover:border-[#C4714A] bg-white hover:bg-[#FAF7F2] shadow-xs transition-all flex items-center justify-between gap-4 group min-h-[56px]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#F6ECE4] group-hover:bg-[#ECCDBE] flex items-center justify-center text-[#C4714A] flex-shrink-0 transition-colors">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-bold text-[#2D231E]">
                    {t("start.digilocker_btn")}
                  </span>
                  <DemoBadge label="DEMO" variant="warning" />
                </div>
                <p className="text-xs text-[#6B5E55] font-medium mt-0.5">
                  {t("start.digilocker_desc")}
                </p>
              </div>
            </div>
            {isLoadingPrefill === "digilocker" ? (
              <Loader2 className="w-5 h-5 text-[#C4714A] animate-spin" />
            ) : (
              <ArrowRight className="w-5 h-5 text-[#8C7E74] group-hover:text-[#C4714A] group-hover:translate-x-1 transition-all" />
            )}
          </button>

          {/* 2. Aadhaar QR Option */}
          <button
            onClick={() => handleSimulatePrefill("aadhaar_qr")}
            disabled={isLoadingPrefill !== null}
            className="w-full text-left p-4 rounded-2xl border border-[#E8DFD5] hover:border-[#4F7B55] bg-white hover:bg-[#FAF7F2] shadow-xs transition-all flex items-center justify-between gap-4 group min-h-[56px]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#EBF2EC] group-hover:bg-[#CADBCB] flex items-center justify-center text-[#4F7B55] flex-shrink-0 transition-colors">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-bold text-[#2D231E]">
                    {t("start.aadhaar_btn")}
                  </span>
                  <DemoBadge label="DEMO" variant="warning" />
                </div>
                <p className="text-xs text-[#6B5E55] font-medium mt-0.5">
                  {t("start.aadhaar_desc")}
                </p>
              </div>
            </div>
            {isLoadingPrefill === "aadhaar_qr" ? (
              <Loader2 className="w-5 h-5 text-[#4F7B55] animate-spin" />
            ) : (
              <ArrowRight className="w-5 h-5 text-[#8C7E74] group-hover:text-[#4F7B55] group-hover:translate-x-1 transition-all" />
            )}
          </button>

          {/* 3. Manual Entry Button (Required by smoke test) */}
          <button
            onClick={handleManualStart}
            className="w-full text-left p-4 rounded-2xl border-2 border-[#C4714A] bg-[#F6ECE4] hover:bg-[#ECCDBE] shadow-sm transition-all flex items-center justify-between gap-4 group min-h-[56px]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#C4714A] flex items-center justify-center text-white flex-shrink-0 shadow-xs">
                <Edit3 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-base sm:text-lg font-black text-[#2D231E]">
                  {t("start.manual_btn")}
                </span>
                <p className="text-xs text-[#6B5E55] font-medium mt-0.5">
                  {t("start.manual_desc")}
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-[#C4714A] group-hover:translate-x-1 transition-all" />
          </button>
        </div>
      </div>

      {prefillFeedback && (
        <div className="bg-[#EBF2EC] border border-[#CADBCB] text-[#4F7B55] p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-[#4F7B55]" />
          <span>{prefillFeedback}</span>
        </div>
      )}

      <LoginRegisterModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultTab={authModalTab}
      />
    </div>
  );
};
