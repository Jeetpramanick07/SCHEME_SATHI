import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useHousehold } from "../../context/HouseholdContext";
import { useTranslation } from "../../context/I18nContext";
import { api } from "../../api/client";
import {
  X,
  LogIn,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Building2,
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Language } from "../../api/types";

interface LoginRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "login" | "register";
}

export const LoginRegisterModal: React.FC<LoginRegisterModalProps> = ({
  isOpen,
  onClose,
  defaultTab = "login",
}) => {
  const { loginCitizen, registerCitizen } = useAuth();
  const { setHouseholdId, setMemberId, setBatchAnswers } = useHousehold();
  const { language, setLanguage } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"login" | "register">(defaultTab);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("Maharashtra");
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDemoFill = () => {
    setUsername("widow_nagpur");
    setPassword("pass123");
    setError(null);
  };

  const handleSendOtp = () => {
    if (!phone || phone.length < 10) {
      setError(
        language === "mr"
          ? "कृपया योग्य 10-अंकी मोबाईल नंबर प्रविष्ट करा"
          : "Please enter a valid 10-digit mobile number"
      );
      return;
    }
    setError(null);
    setOtpSent(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (activeTab === "login") {
        const user = await loginCitizen(username, password);
        setHouseholdId(user.household_id);
        setMemberId(user.member_id);

        try {
          const profile = await api.getUserProfile({ user_id: user.id, household_id: user.household_id });
          if (profile.answers && Object.keys(profile.answers).length > 0) {
            await setBatchAnswers(profile.answers);
          }
        } catch {
          // ignore
        }

        setSuccessMsg(
          language === "mr"
            ? "यशस्वी लॉगिन झाले!"
            : language === "hi"
            ? "सफलतापूर्वक लॉगिन हुआ!"
            : "Successfully logged in!"
        );

        setTimeout(() => {
          onClose();
          if (!user.profile_completed) {
            navigate("/profile");
          }
        }, 600);
      } else {
        if (!username.trim() || !password.trim()) {
          setError(
            language === "mr"
              ? "कृपया वापरकर्ता आयडी आणि पासवर्ड भरा"
              : language === "hi"
              ? "कृपया आईडी और पासवर्ड भरें"
              : "Please enter ID and password"
          );
          setIsLoading(false);
          return;
        }

        const user = await registerCitizen({
          username,
          password,
          full_name: fullName,
          phone,
        });

        await setBatchAnswers({});
        setHouseholdId(user.household_id);
        setMemberId(user.member_id);

        setSuccessMsg(
          language === "mr"
            ? "नवीन खाते तयार झाले! तुमचे प्रोफाइल पूर्ण करा."
            : language === "hi"
            ? "नया खाता तैयार हो गया! अपनी प्रोफाइल पूरी करें।"
            : "Account created successfully! Please complete your profile."
        );

        setTimeout(() => {
          onClose();
          navigate("/profile");
        }, 800);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[#FAF7F2] text-[#2D231E] rounded-3xl shadow-2xl border border-[#E8DFD5] max-w-md w-full overflow-hidden my-6">
        {/* Top Header matching 1_Create_Account.png */}
        <div className="p-5 pb-3 border-b border-[#E8DFD5] relative bg-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#6B5E55] hover:text-[#2D231E] p-1.5 rounded-full hover:bg-[#FAF7F2] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl overflow-hidden shadow-xs border border-[#DECFC0] bg-[#FAF7F2] flex items-center justify-center flex-shrink-0">
                <img src="/logo.jpg" alt="Scheme Sathi" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-base font-black text-[#2D231E] leading-tight">
                  Scheme <span className="text-[#4F7B55]">Sathi</span>
                </h2>
                <p className="text-[10px] text-[#6B5E55] font-semibold">Sarkari Sahayak • Welfare Portal</p>
              </div>
            </div>

            {/* Language Switch Pills */}
            <div className="flex items-center bg-[#FAF7F2] p-0.5 rounded-xl border border-[#E8DFD5]">
              {(["mr", "hi"] as Language[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLanguage(l)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                    language === l ? "bg-[#C4714A] text-white" : "text-[#6B5E55]"
                  }`}
                >
                  {l === "mr" ? "मराठी" : "हिंदी"}
                </button>
              ))}
            </div>
          </div>

          {/* Segmented Tab Switcher matching 1_Create_Account.png */}
          <div className="flex bg-[#FAF7F2] p-1 rounded-2xl mt-4 border border-[#E8DFD5]">
            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setError(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "register"
                  ? "bg-[#C4714A] text-white shadow-sm"
                  : "text-[#6B5E55] hover:text-[#2D231E]"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{language === "mr" ? "नवीन नोंदणी" : language === "hi" ? "नया पंजीकरण" : "New Registration"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setError(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "login"
                  ? "bg-[#C4714A] text-white shadow-sm"
                  : "text-[#6B5E55] hover:text-[#2D231E]"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{language === "mr" ? "लॉगिन करा" : language === "hi" ? "लॉगिन करें" : "Login"}</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div className="text-center pb-1">
            <h3 className="text-base font-black text-[#2D231E]">
              {activeTab === "register"
                ? (language === "mr" ? "तुमचे खाते तयार करा" : "Create Your Account")
                : (language === "mr" ? "खात्यात लॉगिन करा" : "Login to Your Account")}
            </h3>
            <p className="text-xs text-[#6B5E55] font-medium mt-0.5">
              {activeTab === "register"
                ? (language === "mr" ? "सरकारी योजनांचा लाभ घेण्यासाठी खाते सुरू करा" : "Get started to access government schemes easily")
                : (language === "mr" ? "तुमचे प्रोफाइल व योजना व्यवस्थापित करा" : "Manage your profile and suitable schemes")}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-[#EBF2EC] border border-[#CADBCB] text-[#4F7B55] p-3 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#4F7B55]" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {activeTab === "register" && (
            <>
              {/* Full Name */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#C4714A]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={language === "mr" ? "पूर्ण नाव (उदा. सुनीता गायकवाड)" : "Full Name"}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#E8DFD5] bg-white text-[#2D231E] placeholder:text-[#8C7E74] text-xs font-semibold focus:border-[#C4714A] focus:ring-1 focus:ring-[#C4714A] shadow-xs"
                />
              </div>

              {/* Mobile Number with Send OTP badge */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#C4714A]">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Mobile Number"
                  className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-[#E8DFD5] bg-white text-[#2D231E] placeholder:text-[#8C7E74] text-xs font-semibold focus:border-[#C4714A] focus:ring-1 focus:ring-[#C4714A] shadow-xs"
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className={`absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg text-[11px] font-bold border transition-all ${
                    otpSent
                      ? "bg-[#4F7B55] text-white border-[#4F7B55]"
                      : "bg-white text-[#4F7B55] border-[#4F7B55] hover:bg-[#EBF2EC]"
                  }`}
                >
                  {otpSent ? "✓ OTP Sent" : "Send OTP"}
                </button>
              </div>

              {/* Email Address (Optional) */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#C4714A]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address (Optional)"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#E8DFD5] bg-white text-[#2D231E] placeholder:text-[#8C7E74] text-xs font-semibold focus:border-[#C4714A] focus:ring-1 focus:ring-[#C4714A] shadow-xs"
                />
              </div>
            </>
          )}

          {/* Username / ID */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#C4714A]">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              data-testid="input-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={activeTab === "login" ? "Username / widow_nagpur" : "Create Username (e.g. sunita_ngp)"}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#E8DFD5] bg-white text-[#2D231E] placeholder:text-[#8C7E74] text-xs font-semibold focus:border-[#C4714A] focus:ring-1 focus:ring-[#C4714A] shadow-xs"
            />
          </div>

          {/* Password with Eye show/hide toggle */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#C4714A]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              required
              data-testid="input-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={activeTab === "login" ? "Password" : "Create Password"}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E8DFD5] bg-white text-[#2D231E] placeholder:text-[#8C7E74] text-xs font-semibold focus:border-[#C4714A] focus:ring-1 focus:ring-[#C4714A] shadow-xs"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6B5E55] hover:text-[#2D231E]"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {activeTab === "register" && (
            <>
              {/* State Dropdown */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#C4714A]">
                  <MapPin className="w-4 h-4" />
                </div>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#E8DFD5] bg-white text-[#2D231E] text-xs font-semibold focus:border-[#C4714A] focus:ring-1 focus:ring-[#C4714A] shadow-xs"
                >
                  <option value="Maharashtra">Maharashtra (महाराष्ट्र)</option>
                  <option value="All India">All India / Pan-India</option>
                  <option value="Other">Other State</option>
                </select>
              </div>

              {/* Agreement Checkbox */}
              <label className="flex items-start gap-2 pt-1 cursor-pointer text-[11px] text-[#6B5E55]">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 rounded text-[#4F7B55] focus:ring-[#4F7B55] border-[#E8DFD5]"
                />
                <span>
                  I agree to the{" "}
                  <span className="text-[#4F7B55] font-bold underline">Terms & Conditions</span> and{" "}
                  <span className="text-[#4F7B55] font-bold underline">Privacy Policy</span>
                </span>
              </label>
            </>
          )}

          {activeTab === "login" && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                data-testid="demo-login-btn"
                onClick={handleDemoFill}
                className="text-xs text-[#C4714A] hover:text-[#944C2B] font-bold flex items-center gap-1 hover:underline"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#C4714A]" />
                <span>Quick Demo Fill (widow_nagpur)</span>
              </button>
            </div>
          )}

          {/* Primary Action Button in TAN #C4714A */}
          <button
            type="submit"
            data-testid="login-submit-btn"
            disabled={isLoading}
            className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-[#C4714A] hover:bg-[#B05E38] text-white font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
          >
            {isLoading ? (
              <span>Please wait...</span>
            ) : activeTab === "login" ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>{language === "mr" ? "लॉगिन करा" : language === "hi" ? "लॉगिन करें" : "Login"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{language === "mr" ? "नोंदणी करा" : language === "hi" ? "पंजीकरण करें" : "Register"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Switch tab link */}
          <div className="text-center pt-1 text-xs">
            {activeTab === "register" ? (
              <button
                type="button"
                onClick={() => setActiveTab("login")}
                className="text-[#6B5E55] hover:text-[#C4714A]"
              >
                Already have an account? <span className="font-bold text-[#4F7B55]">Login</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab("register")}
                className="text-[#6B5E55] hover:text-[#C4714A]"
              >
                Don't have an account? <span className="font-bold text-[#4F7B55]">Register</span>
              </button>
            )}
          </div>

          {/* Alternative NGO Access Footer */}
          <div className="pt-3 border-t border-[#E8DFD5] flex items-center justify-between text-xs">
            <span className="text-[#8C7E74] font-medium">NGO / Governance Analyst?</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate("/ngo/login");
              }}
              className="font-bold text-[#4F7B55] hover:underline flex items-center gap-1"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>NGO Portal →</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
