import React, { useState } from "react";
import { Mic, MicOff, Check, X, Edit3 } from "lucide-react";
import { useTranslation } from "../../context/I18nContext";

interface VoiceInputButtonProps {
  onAccept: (recognizedValue: string | number | boolean) => void;
  expectedType?: "boolean" | "number" | "string";
  className?: string;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onAccept,
  expectedType = "string",
  className = "",
}) => {
  const isEnabled = import.meta.env.VITE_ENABLE_VOICE_INPUT !== "false";
  const { language, t } = useTranslation();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [candidateValue, setCandidateValue] = useState<string | number | boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If disabled by flag, don't render
  if (!isEnabled) return null;

  const startListening = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg(t("accessibility.voice_unsupported"));
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      const langCode = language === "mr" ? "mr-IN" : language === "hi" ? "hi-IN" : "en-IN";
      recognition.lang = langCode;
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMsg(null);
        setTranscript("");
        setCandidateValue(null);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript.trim();
        setTranscript(text);
        parseVoiceInput(text);
      };

      recognition.onerror = () => {
        setIsListening(false);
        setErrorMsg("Could not understand voice. Please try again or tap the answer.");
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setErrorMsg("Microphone access failed.");
    }
  };

  const parseVoiceInput = (rawText: string) => {
    const lower = rawText.toLowerCase().trim();

    // 1. Boolean check (yes / no in en, hi, mr)
    if (
      lower.includes("yes") ||
      lower.includes("होय") ||
      lower.includes("हाँ") ||
      lower.includes("हा") ||
      lower.includes("barobar") ||
      lower.includes("आहे")
    ) {
      setCandidateValue(true);
      return;
    }

    if (
      lower.includes("no") ||
      lower.includes("नाही") ||
      lower.includes("नहीं") ||
      lower.includes("nahi")
    ) {
      setCandidateValue(false);
      return;
    }

    // 2. Number check
    const match = rawText.match(/[0-9]+/);
    if (match) {
      const num = parseInt(match[0], 10);
      setCandidateValue(num);
      return;
    }

    // Fallback: raw text
    setCandidateValue(rawText);
  };

  const handleConfirm = () => {
    if (candidateValue !== null) {
      onAccept(candidateValue);
      setCandidateValue(null);
      setTranscript("");
    }
  };

  const handleCancel = () => {
    setCandidateValue(null);
    setTranscript("");
    setErrorMsg(null);
  };

  return (
    <div className="relative inline-flex flex-wrap items-center gap-2">
      <button
        onClick={startListening}
        type="button"
        disabled={isListening}
        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium transition-all ${
          isListening
            ? "bg-red-600 text-white animate-pulse"
            : "bg-slate-200 text-slate-800 hover:bg-slate-300 active:scale-95"
        } ${className}`}
        title={t("accessibility.voice_input")}
        aria-label={t("accessibility.voice_input")}
        data-testid="voice-input-mic-btn"
      >
        {isListening ? (
          <>
            <MicOff className="w-5 h-5" />
            <span className="text-sm font-bold">{t("accessibility.voice_listening")}</span>
          </>
        ) : (
          <>
            <Mic className="w-5 h-5 text-blue-700" />
            <span className="text-sm font-semibold">{t("accessibility.voice_input")}</span>
          </>
        )}
      </button>

      {/* Voice consent notice line next to mic */}
      <span
        data-testid="voice-consent-notice"
        className="text-[11px] text-slate-500 font-medium leading-tight max-w-xs select-none"
      >
        🎙️ आवाज केवळ तात्पुरत्या प्रक्रियेसाठी वापरला जातो, कधीही साठवला जात नाही (Memory-only, never stored)
      </span>

      {/* Recognized text preview with live tap-to-correct before saving */}
      {candidateValue !== null && (
        <div className="absolute top-full mt-2 left-0 z-50 w-80 bg-white border-2 border-blue-600 rounded-xl shadow-xl p-3 text-slate-900 animate-in fade-in">
          <div className="text-xs font-semibold text-slate-500 mb-1 flex items-center justify-between">
            <span>{t("accessibility.voice_hint")}</span>
            <span className="text-[10px] text-slate-400 italic">Live Transcript</span>
          </div>

          <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-950 font-medium">
            <div className="text-xs text-slate-500 italic mb-1">
              "{transcript || String(candidateValue)}"
            </div>

            {/* Editable Tap-to-correct input */}
            <div className="flex items-center gap-1.5 mt-1">
              <Edit3 className="w-4 h-4 text-blue-600 flex-shrink-0" />
              {typeof candidateValue === "boolean" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCandidateValue(true)}
                    className={`px-3 py-1 rounded text-xs font-bold border ${candidateValue ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700"}`}
                  >
                    {t("questionnaire.yes")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCandidateValue(false)}
                    className={`px-3 py-1 rounded text-xs font-bold border ${!candidateValue ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-700"}`}
                  >
                    {t("questionnaire.no")}
                  </button>
                </div>
              ) : (
                <input
                  type={expectedType === "number" ? "number" : "text"}
                  data-testid="tap-to-correct-input"
                  value={String(candidateValue)}
                  onChange={(e) => {
                    const val = expectedType === "number" ? (e.target.value ? parseFloat(e.target.value) : "") : e.target.value;
                    setCandidateValue(val);
                  }}
                  className="w-full px-2.5 py-1 text-sm font-bold text-slate-900 bg-white border border-blue-300 rounded focus:outline-blue-500"
                />
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-600 mt-1.5">
            {t("accessibility.tap_to_correct")}
          </p>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleConfirm}
              type="button"
              data-testid="use-voice-value-btn"
              className="flex-1 inline-flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg text-sm transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Use Value</span>
            </button>
            <button
              onClick={handleCancel}
              type="button"
              className="inline-flex items-center justify-center p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="w-full text-xs text-red-600 font-medium mt-1">
          {errorMsg}
        </div>
      )}
    </div>
  );
};
