import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useHousehold } from "../../context/HouseholdContext";
import { useTranslation } from "../../context/I18nContext";
import { api } from "../../api/client";
import { useNavigate } from "react-router-dom";
import {
  UserCheck,
  ShieldCheck,
  Sparkles,
  Save,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  MapPin,
  Briefcase,
  BadgePercent,
  Lock,
  Loader2,
  RefreshCw,
} from "lucide-react";

export const ProfileDashboardView: React.FC = () => {
  const { user, updateUser, isAuthenticated } = useAuth();
  const { householdId, memberId, answers, setBatchAnswers, reevaluate } = useHousehold();
  const { language } = useTranslation();
  const navigate = useNavigate();

  // Local form state initialized from answers / user - START BLANK FOR NEW USERS!
  const [fullName, setFullName] = useState<string>(user?.full_name || "");
  const [maskedAadhaar, setMaskedAadhaar] = useState<string>(user?.masked_aadhaar || "");
  const [digiVerified, setDigiVerified] = useState<boolean>(user?.digilocker_linked || false);
  const [isFetchingDigi, setIsFetchingDigi] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Core profile fields - NO HARDCODED AUTO-FILL FOR NEW CITIZENS!
  const [age, setAge] = useState<number | string>(() => (answers.age ? Number(answers.age) : ""));
  const [gender, setGender] = useState<string>(() => (answers.gender as string) || "");
  const [maritalStatus, setMaritalStatus] = useState<string>(() => (answers.marital_status as string) || "");
  const [casteCategory, setCasteCategory] = useState<string>(() => (answers.caste_category as string) || "");
  const [isDifferentlyAbled, setIsDifferentlyAbled] = useState<string>(
    answers.is_differently_abled !== undefined ? (answers.is_differently_abled ? "yes" : "no") : ""
  );
  const [disabilityPercentage, setDisabilityPercentage] = useState<number | string>(
    () => (answers.disability_percentage ? Number(answers.disability_percentage) : "")
  );

  // Address - NO HARDCODED DEFAULTS!
  const [district, setDistrict] = useState<string>(() => (answers.district as string) || "");
  const [taluka, setTaluka] = useState<string>(() => (answers.taluka as string) || "");
  const [areaType, setAreaType] = useState<string>(() => (answers.area_type as string) || "");
  const [yearsInMaharashtra, setYearsInMaharashtra] = useState<number | string>(
    () =>
      (answers.years_in_maharashtra_gte as number) ||
      (answers.years_in_maharashtra as number) ||
      ""
  );

  // Economic & Land - NO HARDCODED DEFAULTS!
  const [occupation, setOccupation] = useState<string>(() => (answers.occupation as string) || "");
  const [annualIncome, setAnnualIncome] = useState<number | string>(
    () => (answers.annual_family_income !== undefined ? Number(answers.annual_family_income) : "")
  );
  const [rationCardType, setRationCardType] = useState<string>(
    () => (answers.ration_card_type as string) || ""
  );
  const [ownsLand, setOwnsLand] = useState<string>(
    answers.owns_cultivable_land !== undefined ? (answers.owns_cultivable_land ? "yes" : "no") : ""
  );
  const [landHectares, setLandHectares] = useState<number | string>(
    () => (answers.landholding_hectares !== undefined ? Number(answers.landholding_hectares) : "")
  );

  // Load server profile on mount if authenticated and has saved data
  useEffect(() => {
    if (user?.id) {
      api
        .getUserProfile({ user_id: user.id, household_id: user.household_id || householdId })
        .then((res) => {
          if (res.user?.full_name) setFullName(res.user.full_name);
          if (res.user?.masked_aadhaar) setMaskedAadhaar(res.user.masked_aadhaar);
          if (res.user?.digilocker_linked) setDigiVerified(true);

          const a = res.answers;
          if (a) {
            if (a.age) setAge(Number(a.age));
            if (a.gender) setGender(String(a.gender));
            if (a.marital_status) setMaritalStatus(String(a.marital_status));
            if (a.caste_category) setCasteCategory(String(a.caste_category));
            if (a.district) setDistrict(String(a.district));
            if (a.taluka) setTaluka(String(a.taluka));
            if (a.area_type) setAreaType(String(a.area_type));
            if (a.annual_family_income !== undefined && a.annual_family_income !== null) {
              setAnnualIncome(Number(a.annual_family_income));
            }
            if (a.occupation) setOccupation(String(a.occupation));
            if (a.ration_card_type) setRationCardType(String(a.ration_card_type));
            if (a.years_in_maharashtra_gte || a.years_in_maharashtra) {
              setYearsInMaharashtra(Number(a.years_in_maharashtra_gte || a.years_in_maharashtra));
            }
            if (a.is_differently_abled !== undefined) {
              setIsDifferentlyAbled(a.is_differently_abled ? "yes" : "no");
            }
            if (a.disability_percentage) {
              setDisabilityPercentage(Number(a.disability_percentage));
            }
            if (a.owns_cultivable_land !== undefined) {
              setOwnsLand(a.owns_cultivable_land ? "yes" : "no");
            }
            if (a.landholding_hectares) {
              setLandHectares(Number(a.landholding_hectares));
            }
          }
        })
        .catch(() => {});
    }
  }, [user?.id, user?.household_id, householdId]);

  // Handle DigiLocker Auto-Fetch
  const handleFetchDigiLocker = async () => {
    setIsFetchingDigi(true);
    setFeedback(null);
    try {
      const res = await api.fetchDigiLockerProfile({
        user_id: user?.id,
        household_id: user?.household_id || householdId,
        member_id: user?.member_id || memberId || undefined,
      });

      const d = res.data;
      setFullName(d.full_name);
      setAge(d.age);
      setGender(d.gender);
      setMaritalStatus(d.marital_status);
      setCasteCategory(d.caste_category);
      setDistrict(d.district);
      setTaluka(d.taluka);
      setMaskedAadhaar(d.masked_aadhaar);
      setDigiVerified(true);
      if (d.ration_card_type) setRationCardType(d.ration_card_type);
      if (d.annual_family_income !== undefined) setAnnualIncome(d.annual_family_income);
      if (d.occupation) setOccupation(d.occupation);
      if (d.years_in_maharashtra_gte !== undefined) setYearsInMaharashtra(d.years_in_maharashtra_gte);

      // Update user state if logged in
      if (user) {
        updateUser({
          ...user,
          full_name: d.full_name,
          masked_aadhaar: d.masked_aadhaar,
          digilocker_linked: true,
        });
      }

      setFeedback({
        type: "success",
        message:
          language === "mr"
            ? "डिजीलॉकरद्वारे अधिकृत माहिती यशस्वीरित्या प्राप्त झाली!"
            : language === "hi"
            ? "डिजीलॉकर से अधिकृत जानकारी सफलतापूर्वक प्राप्त हुई!"
            : "Official details fetched successfully from DigiLocker!",
      });
    } catch {
      setFeedback({
        type: "error",
        message:
          language === "mr"
            ? "डिजीलॉकर जोडणी अयशस्वी. कृपया मॅन्युअली तपशील भरा."
            : language === "hi"
            ? "डिजीलॉकर कनेक्शन विफल। कृपया मैन्युअल विवरण भरें।"
            : "DigiLocker fetch failed. Please enter details manually.",
      });
    } finally {
      setIsFetchingDigi(false);
    }
  };

  // Compute local completion
  const checkCompletion = () => {
    let score = 0;
    if (fullName.trim()) score += 10;
    if (age !== "" && Number(age) > 0) score += 10;
    if (gender) score += 10;
    if (maritalStatus) score += 10;
    if (casteCategory) score += 10;
    if (district) score += 10;
    if (occupation) score += 10;
    if (annualIncome !== "" && annualIncome !== undefined) score += 10;
    if (rationCardType) score += 10;
    if (maskedAadhaar) score += 10;
    return score;
  };

  const completionPct = checkCompletion();

  // Save Profile Handler
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    // Build answer payload
    const updatedAnswers: Record<string, unknown> = {
      ...answers,
      age: age !== "" ? Number(age) : undefined,
      gender: gender || undefined,
      marital_status: maritalStatus || undefined,
      is_widow: maritalStatus === "widowed",
      caste_category: casteCategory || undefined,
      is_differently_abled: isDifferentlyAbled === "yes",
      disability_percentage: isDifferentlyAbled === "yes" && disabilityPercentage !== "" ? Number(disabilityPercentage) : 0,
      residence_state: "Maharashtra",
      district: district || undefined,
      taluka: taluka || undefined,
      area_type: areaType || undefined,
      years_in_maharashtra_gte: yearsInMaharashtra !== "" ? Number(yearsInMaharashtra) : undefined,
      occupation: occupation || undefined,
      annual_family_income: annualIncome !== "" ? Number(annualIncome) : undefined,
      ration_card_type: rationCardType || undefined,
      belongs_to_bpl_household: rationCardType === "yellow_bpl" || rationCardType === "antodaya",
      owns_cultivable_land: ownsLand === "yes",
      landholding_hectares: ownsLand === "yes" && landHectares !== "" ? Number(landHectares) : 0,
      has_aadhaar: Boolean(maskedAadhaar),
      has_bank_account: true,
      has_aadhaar_linked_bank: true,
      has_income_certificate: true,
      has_caste_certificate: Boolean(casteCategory && casteCategory !== "GENERAL"),
      has_domicile_certificate: true,
    };

    try {
      // 1. Update household answers locally & trigger re-eval
      await setBatchAnswers(updatedAnswers);

      // 2. Persist to backend user-profile
      const effectiveHhId = user?.household_id || householdId;
      const effectiveMemId = user?.member_id || memberId || undefined;

      const res = await api.updateUserProfile({
        user_id: user?.id,
        household_id: effectiveHhId,
        member_id: effectiveMemId,
        full_name: fullName,
        masked_aadhaar: maskedAadhaar,
        answers: updatedAnswers,
      });

      if (user) {
        updateUser({
          ...user,
          full_name: fullName,
          masked_aadhaar: maskedAadhaar,
          profile_completed: res.is_complete,
        });
      }

      // Reevaluate suitable schemes immediately with the updated answers
      await reevaluate(false);

      setFeedback({
        type: "success",
        message:
          language === "mr"
            ? "प्रोफाइल यशस्वीरीत्या जतन केले! तुमच्यासाठी योग्य योजना तयार आहेत."
            : language === "hi"
            ? "प्रोफाइल सफलतापूर्वक सहेज लिया गया! आपकी उपयुक्त योजनाएं तैयार हैं।"
            : "Profile saved successfully! Suitable welfare schemes are ready.",
      });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save profile",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4 px-3 sm:px-4 text-slate-900">
      {/* Top Profile Summary Card */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-950 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-blue-700/40 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl font-black text-white shadow-inner flex-shrink-0">
              {fullName ? fullName.charAt(0) : "👤"}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                  {fullName || (language === "mr" ? "नवीन नागरिक प्रोफाइल" : "Citizen Profile")}
                </h1>
                {digiVerified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>DigiLocker Verified</span>
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-blue-200 mt-1 flex flex-wrap items-center gap-2">
                <span>
                  ID: <span className="font-mono text-white font-bold">{user?.username || "Guest / Unsaved"}</span>
                </span>
                <span>•</span>
                <span>
                  Aadhaar: <span className="font-mono text-white font-bold">{maskedAadhaar || "अद्याप जोडलेले नाही"}</span>
                </span>
              </p>
            </div>
          </div>

          {/* Direct CTA to view schemes */}
          <button
            type="button"
            data-testid="profile-see-schemes-btn"
            onClick={async () => {
              await handleSaveProfile();
              navigate("/results");
            }}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-950/40 transition-transform active:scale-95 flex-shrink-0"
          >
            <span>
              {language === "mr"
                ? "माझ्यासाठी योग्य योजना पहा"
                : language === "hi"
                ? "मेरे लिए उपयुक्त योजनाएं देखें"
                : "See Suitable Schemes"}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Completion Progress Bar */}
        <div className="mt-5 pt-4 border-t border-white/15">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-blue-200">
              {language === "mr"
                ? "प्रोफाइल पूर्णता पातळी"
                : language === "hi"
                ? "प्रोफाइल पूर्णता स्तर"
                : "Profile Completion Score"}
            </span>
            <span className={completionPct >= 70 ? "text-emerald-300 font-black" : "text-amber-300 font-black"}>
              {completionPct}% {completionPct >= 70 ? "✓ पूर्ण" : "(तपशील भरा किंवा डिजीलॉकर वापरा)"}
            </span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completionPct >= 70 ? "bg-emerald-400" : "bg-amber-400"
              }`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* DigiLocker Auto-Fetch Banner */}
      <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 border-2 border-amber-300 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-amber-950">
              {language === "mr"
                ? "डिजीलॉकरद्वारे जलद पडताळणी (DigiLocker Auto-Fetch)"
                : language === "hi"
                ? "डिजीलॉकर द्वारा त्वरित सत्यापन (DigiLocker Auto-Fetch)"
                : "Fast Certified DigiLocker Fetch"}
            </h3>
            <p className="text-xs text-amber-900/90 font-medium mt-0.5 max-w-xl leading-relaxed">
              {language === "mr"
                ? "नाव, वय, लिंग, पत्ता आणि रेशन कार्ड माहिती थेट सरकारी डिजीलॉकरवरून आपोआप भरा. मॅन्युअल भरण्याची गरज नाही."
                : language === "hi"
                ? "नाम, आयु, लिंग, पता और राशन कार्ड की जानकारी सीधे सरकारी डिजीलॉकर से स्वतः भरें।"
                : "Auto-fetch certified name, age, gender, address, and ration card directly from DigiLocker."}
            </p>
          </div>
        </div>
        <button
          type="button"
          data-testid="profile-digilocker-fetch-btn"
          onClick={handleFetchDigiLocker}
          disabled={isFetchingDigi}
          className="flex-shrink-0 px-5 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-600/30 transition-transform active:scale-95"
        >
          {isFetchingDigi ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>पडताळणी सुरू...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>
                {language === "mr"
                  ? "⚡ डिजीलॉकरवरून माहिती आणा"
                  : language === "hi"
                  ? "⚡ डिजीलॉकर से जानकारी लाएं"
                  : "⚡ Fetch from DigiLocker"}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in shadow-sm ${
            feedback.type === "success"
              ? "bg-emerald-50 border-2 border-emerald-500 text-emerald-950"
              : "bg-red-50 border-2 border-red-500 text-red-950"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Comprehensive Profile Form */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Section 1: ओळखपत्र व सुरक्षा (Identity & Aadhaar) */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border-2 border-slate-200 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Lock className="w-5 h-5 text-blue-700" />
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              {language === "mr"
                ? "१. ओळखपत्र व आधार कार्ड (Identity & Aadhaar)"
                : language === "hi"
                ? "१. पहचान व आधार कार्ड (Identity & Aadhaar)"
                : "1. Identity & Aadhaar Card"}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                {language === "mr" ? "पूर्ण नाव (Full Name)" : "Full Name"}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="उदा. सुनीता नामदेव गायकवाड"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold shadow-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                {language === "mr" ? "आधार कार्ड (मास्क केलेले / Masked Aadhaar)" : "Aadhaar Card (Masked)"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={maskedAadhaar}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Safety: prevent raw 12-digit number exposure
                    if (/^\d{12}$/.test(v.replace(/\s+/g, ""))) {
                      const last4 = v.slice(-4);
                      setMaskedAadhaar(`XXXX-XXXX-${last4}`);
                    } else {
                      setMaskedAadhaar(v);
                    }
                  }}
                  placeholder="उदा. XXXX-XXXX-8921"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold font-mono shadow-sm transition-all"
                />
                <span className="absolute right-3 top-3 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  सुरक्षित (Masked)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                गोपनीयतेसाठी केवळ शेवटचे ४ अंक सुरक्षित ठेवले जातात. (No full 12 digits stored)
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: वैयक्तिक माहिती (Personal Details) */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border-2 border-slate-200 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <UserCheck className="w-5 h-5 text-blue-700" />
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              {language === "mr"
                ? "२. वैयक्तिक माहिती (Personal Details)"
                : language === "hi"
                ? "२. व्यक्तिगत विवरण (Personal Details)"
                : "2. Personal Details"}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                {language === "mr" ? "वय (वर्षे)" : language === "hi" ? "आयु (वर्ष)" : "Age (Years)"}
              </label>
              <input
                type="number"
                min="0"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="उदा. 62"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold shadow-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                {language === "mr" ? "लिंग" : language === "hi" ? "लिंग" : "Gender"}
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold shadow-sm transition-all"
              >
                <option value="">-- निवडा (Select) --</option>
                <option value="FEMALE">महिला (Female)</option>
                <option value="MALE">पुरुष (Male)</option>
                <option value="TRANSGENDER">तृतीयपंथी (Transgender)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                {language === "mr" ? "वैवाहिक स्थिती" : language === "hi" ? "वैवाहिक स्थिति" : "Marital Status"}
              </label>
              <select
                value={maritalStatus}
                onChange={(e) => setMaritalStatus(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold shadow-sm transition-all"
              >
                <option value="">-- निवडा (Select) --</option>
                <option value="widowed">विधवा (Widow)</option>
                <option value="married">विवाहित (Married)</option>
                <option value="unmarried">अविवाहित (Unmarried)</option>
                <option value="divorced">घटस्फोटित (Divorced)</option>
                <option value="abandoned">परित्यक्ता (Abandoned)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                {language === "mr" ? "सामाजिक प्रवर्ग" : language === "hi" ? "सामाजिक श्रेणी" : "Social Category"}
              </label>
              <select
                value={casteCategory}
                onChange={(e) => setCasteCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold shadow-sm transition-all"
              >
                <option value="">-- निवडा (Select) --</option>
                <option value="SC">अनुसूचित जाती (SC)</option>
                <option value="ST">अनुसूचित जमाती (ST)</option>
                <option value="OBC">इतर मागासवर्गीय (OBC)</option>
                <option value="GENERAL">खुला प्रवर्ग (General / EWS)</option>
                <option value="VJNT">विमुक्त जाती / भटक्या जमाती (VJNT)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                {language === "mr" ? "दिव्यांगत्व आहे का?" : "Specially Abled / Disability?"}
              </label>
              <select
                value={isDifferentlyAbled}
                onChange={(e) => setIsDifferentlyAbled(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold shadow-sm transition-all"
              >
                <option value="">-- निवडा (Select) --</option>
                <option value="no">नाही (No)</option>
                <option value="yes">होय (Yes)</option>
              </select>
            </div>

            {isDifferentlyAbled === "yes" && (
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                  {language === "mr" ? "दिव्यांगत्व टक्केवारी (%)" : "Disability Percentage (%)"}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={disabilityPercentage}
                  onChange={(e) => setDisabilityPercentage(e.target.value)}
                  placeholder="उदा. 40"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold shadow-sm transition-all"
                />
              </div>
            )}
          </div>
        </div>

        {/* Section 3: पत्ता व भौगोलिक क्षेत्र (Address & Location) */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border-2 border-slate-200 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <MapPin className="w-5 h-5 text-blue-700" />
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              {language === "mr"
                ? "३. पत्ता व भौगोलिक क्षेत्र (Address & Geography)"
                : language === "hi"
                ? "३. पता और भौगोलिक क्षेत्र (Address & Geography)"
                : "3. Address & Geography"}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                {language === "mr" ? "जिल्हा (District)" : "District"}
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold shadow-sm transition-all"
              >
                <option value="">-- निवडा (Select) --</option>
                <option value="Nagpur">नागपूर (Nagpur)</option>
                <option value="Wardha">वर्धा (Wardha)</option>
                <option value="Amravati">अमरावती (Amravati)</option>
                <option value="Chandrapur">चंद्रपूर (Chandrapur)</option>
                <option value="Gadchiroli">गडचिरोली (Gadchiroli)</option>
                <option value="Bhandara">भंडारा (Bhandara)</option>
                <option value="Gondia">गोंदिया (Gondia)</option>
                <option value="Yavatmal">यवतमाळ (Yavatmal)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                {language === "mr" ? "तालुका (Taluka)" : "Taluka"}
              </label>
              <input
                type="text"
                value={taluka}
                onChange={(e) => setTaluka(e.target.value)}
                placeholder="उदा. नागपूर शहर / ग्रामीण"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold shadow-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                {language === "mr" ? "परिसर प्रकार" : "Area Setting"}
              </label>
              <select
                value={areaType}
                onChange={(e) => setAreaType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold shadow-sm transition-all"
              >
                <option value="">-- निवडा (Select) --</option>
                <option value="URBAN">शहरी (Urban)</option>
                <option value="RURAL">ग्रामीण (Rural)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                {language === "mr" ? "महाराष्ट्रात वास्तव्य (वर्षे)" : "Years in Maharashtra"}
              </label>
              <input
                type="number"
                min="0"
                value={yearsInMaharashtra}
                onChange={(e) => setYearsInMaharashtra(e.target.value)}
                placeholder="उदा. 25"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold shadow-sm transition-all"
              />
            </div>
          </div>
        </div>

        {/* Section 4: आर्थिक व शेती तपशील (Economic & Land Details) */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border-2 border-slate-200 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Briefcase className="w-5 h-5 text-blue-700" />
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              {language === "mr"
                ? "४. आर्थिक व शेती तपशील (Economic & Land Details)"
                : language === "hi"
                ? "४. आर्थिक व कृषि विवरण (Economic & Land Details)"
                : "4. Economic & Land Details"}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                {language === "mr" ? "मुख्य व्यवसाय" : language === "hi" ? "मुख्य व्यवसाय" : "Occupation"}
              </label>
              <select
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold shadow-sm transition-all"
              >
                <option value="">-- निवडा (Select) --</option>
                <option value="agricultural_labour">शेतमजूर (Agricultural Labour)</option>
                <option value="farmer">शेतकरी (Farmer)</option>
                <option value="construction_worker">बांधकाम कामगार (Construction Worker)</option>
                <option value="street_vendor">फेरीवाला / पथविक्रेता (Street Vendor)</option>
                <option value="domestic_worker">घरकामगार (Domestic Worker)</option>
                <option value="homemaker">गृहिणी (Homemaker)</option>
                <option value="senior_citizen">ज्येष्ठ नागरिक / निवृत्त (Senior Citizen)</option>
                <option value="unemployed">बेरोजगार (Unemployed)</option>
                <option value="other">इतर (Other)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                {language === "mr"
                  ? "वार्षिक कौटुंबिक उत्पन्न (₹)"
                  : language === "hi"
                  ? "वार्षिक पारिवारिक आय (₹)"
                  : "Annual Household Income (₹)"}
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={annualIncome}
                onChange={(e) => setAnnualIncome(e.target.value)}
                placeholder="उदा. 48000"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold shadow-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                {language === "mr" ? "रेशन कार्ड प्रवर्ग" : language === "hi" ? "राशन कार्ड श्रेणी" : "Ration Card Type"}
              </label>
              <select
                value={rationCardType}
                onChange={(e) => setRationCardType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold shadow-sm transition-all"
              >
                <option value="">-- निवडा (Select) --</option>
                <option value="yellow_bpl">पिवळे रेशन कार्ड / बीपीएल (Yellow BPL)</option>
                <option value="antodaya">अंत्योदय अन्न योजना (AAY)</option>
                <option value="orange_apl">केशरी रेशन कार्ड (Orange APL)</option>
                <option value="white">पांढरे रेशन कार्ड (White Card)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                {language === "mr" ? "स्वतःची शेतजमीन आहे का?" : "Own Cultivable Land?"}
              </label>
              <select
                value={ownsLand}
                onChange={(e) => setOwnsLand(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold shadow-sm transition-all"
              >
                <option value="">-- निवडा (Select) --</option>
                <option value="no">नाही (No)</option>
                <option value="yes">होय (Yes)</option>
              </select>
            </div>

            {ownsLand === "yes" && (
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                  {language === "mr" ? "जमीन क्षेत्र (हेक्टर)" : "Land Area (Hectares)"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={landHectares}
                  onChange={(e) => setLandHectares(e.target.value)}
                  placeholder="उदा. 1.5"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold shadow-sm transition-all"
                />
              </div>
            )}
          </div>
        </div>

        {/* Submit Actions Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto min-h-[50px] px-8 py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-black rounded-2xl shadow-lg shadow-blue-700/20 text-sm transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>जतन करत आहे...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>
                  {language === "mr"
                    ? "प्रोफाइल माहिती जतन करा"
                    : language === "hi"
                    ? "प्रोफाइल जानकारी सहेजें"
                    : "Save Profile Information"}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            data-testid="profile-see-schemes-btn"
            onClick={async () => {
              await handleSaveProfile();
              navigate("/results");
            }}
            className="w-full sm:w-auto min-h-[50px] px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-700/20 text-sm transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <span>
              {language === "mr"
                ? "पात्र योजना पहा →"
                : language === "hi"
                ? "पात्र योजनाएं देखें →"
                : "See Suitable Schemes →"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
