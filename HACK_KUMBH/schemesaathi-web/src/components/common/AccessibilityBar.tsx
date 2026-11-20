import React from "react";
import { useAccessibility, TextScale } from "../../context/AccessibilityContext";
import { useTranslation } from "../../context/I18nContext";
import { Volume2, VolumeX, Eye, AlertCircle } from "lucide-react";
import { Language } from "../../api/types";

export const AccessibilityBar: React.FC = () => {
  const {
    textScale,
    setTextScale,
    highContrast,
    toggleHighContrast,
    audioMode,
    toggleAudioMode,
    voiceNotice,
    clearVoiceNotice,
  } = useAccessibility();

  const { language, setLanguage, t } = useTranslation();

  const scales: Array<{ key: TextScale; label: string }> = [
    { key: "normal", label: "A" },
    { key: "large", label: "A+" },
    { key: "extra-large", label: "A++" },
  ];

  const langs: Array<{ code: Language; label: string }> = [
    { code: "mr", label: "मराठी" },
    { code: "hi", label: "हिन्दी" },
    { code: "en", label: "English" },
  ];

  return (
    <aside aria-label="Accessibility Toolbar" className="w-full bg-[#F5EFEB] border-b border-[#E8DFD5] px-2.5 sm:px-4 py-1 text-xs">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        {/* Language Selection */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[#6B5E55] font-bold text-[11px] hidden sm:inline whitespace-nowrap">
            {t("language.select") || "भाषा"}:
          </span>
          <div className="flex items-center gap-1 bg-[#EBE2D8] p-0.5 rounded-lg border border-[#DECFC0] flex-shrink-0">
            {langs.map((l) => (
              <button
                key={l.code}
                onClick={() => setLanguage(l.code)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap flex-shrink-0 ${
                  language === l.code
                    ? "bg-[#C4714A] text-white shadow-xs"
                    : "text-[#6B5E55] hover:text-[#2D231E]"
                }`}
                aria-label={`Switch to ${l.label}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accessibility Toggles */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Text scale toggle */}
          <div className="flex items-center bg-[#EBE2D8] rounded-lg border border-[#DECFC0] p-0.5 flex-shrink-0">
            {scales.map((s) => (
              <button
                key={s.key}
                onClick={() => setTextScale(s.key)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap flex-shrink-0 ${
                  textScale === s.key
                    ? "bg-[#C4714A] text-white shadow-xs"
                    : "text-[#6B5E55] hover:text-[#2D231E]"
                }`}
                title={`Text size ${s.label}`}
                aria-label={`Text size ${s.label}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* High Contrast toggle */}
          <button
            onClick={toggleHighContrast}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-all whitespace-nowrap flex-shrink-0 ${
              highContrast
                ? "bg-black text-yellow-300 border-yellow-300 shadow-xs"
                : "bg-[#FAF7F2] text-[#6B5E55] border-[#DECFC0] hover:bg-white"
            }`}
            title="High Contrast Mode"
            aria-label="Toggle High Contrast"
          >
            <Eye className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden md:inline">{t("accessibility.high_contrast") || "High Contrast"}</span>
          </button>

          {/* Auto Read Mode toggle */}
          <button
            onClick={toggleAudioMode}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-all whitespace-nowrap flex-shrink-0 ${
              audioMode
                ? "bg-[#4F7B55] text-white border-[#4F7B55] shadow-xs"
                : "bg-[#FAF7F2] text-[#6B5E55] border-[#DECFC0] hover:bg-white"
            }`}
            title="Auto Read-Aloud Mode"
            aria-label="Toggle Audio Read Mode"
          >
            {audioMode ? (
              <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            <span className="hidden md:inline">{t("accessibility.audio_mode") || "Read Aloud"}</span>
          </button>
        </div>
      </div>

      {/* Voice Warning Notice if language voice is missing */}
      {voiceNotice && (
        <div className="max-w-6xl mx-auto mt-1 flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1 rounded-lg text-xs">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{voiceNotice}</span>
          </div>
          <button
            onClick={clearVoiceNotice}
            className="text-amber-800 font-bold hover:underline ml-2 flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
    </aside>
  );
};
