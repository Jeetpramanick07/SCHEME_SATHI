import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Language } from "../api/types";

export type TextScale = "normal" | "large" | "extra-large";

interface AccessibilityContextValue {
  textScale: TextScale;
  setTextScale: (scale: TextScale) => void;
  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
  toggleHighContrast: () => void;
  audioMode: boolean;
  setAudioMode: (enabled: boolean) => void;
  toggleAudioMode: () => void;
  isSpeaking: boolean;
  speak: (text: string, lang?: Language) => void;
  stopSpeech: () => void;
  hasVoiceForLang: (lang: Language) => boolean;
  voiceNotice: string | null;
  clearVoiceNotice: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [textScale, setTextScaleState] = useState<TextScale>(() => {
    const saved = localStorage.getItem("schemesaathi_text_scale");
    if (saved === "normal" || saved === "large" || saved === "extra-large") return saved;
    return "normal";
  });

  const [highContrast, setHighContrastState] = useState<boolean>(() => {
    return localStorage.getItem("schemesaathi_high_contrast") === "true";
  });

  const [audioMode, setAudioModeState] = useState<boolean>(() => {
    return localStorage.getItem("schemesaathi_audio_mode") === "true";
  });

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const setTextScale = (scale: TextScale) => {
    setTextScaleState(scale);
    localStorage.setItem("schemesaathi_text_scale", scale);
  };

  const setHighContrast = (enabled: boolean) => {
    setHighContrastState(enabled);
    localStorage.setItem("schemesaathi_high_contrast", String(enabled));
  };

  const toggleHighContrast = () => setHighContrast(!highContrast);

  const setAudioMode = (enabled: boolean) => {
    setAudioModeState(enabled);
    localStorage.setItem("schemesaathi_audio_mode", String(enabled));
  };

  const toggleAudioMode = () => setAudioMode(!audioMode);

  // Apply CSS scale and high contrast classes to root html
  useEffect(() => {
    const root = document.documentElement;

    // Reset size classes
    root.classList.remove("text-scale-normal", "text-scale-large", "text-scale-extra-large");
    root.classList.add(`text-scale-${textScale}`);

    if (textScale === "normal") {
      root.style.fontSize = "16px";
    } else if (textScale === "large") {
      root.style.fontSize = "19px";
    } else if (textScale === "extra-large") {
      root.style.fontSize = "23px";
    }

    if (highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }
  }, [textScale, highContrast]);

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const updateVoices = () => {
        const v = window.speechSynthesis.getVoices();
        setAvailableVoices(v);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // SpeechSynthesis read-aloud with robust fallback
  const speak = useCallback((text: string, lang: Language = "mr") => {
    if (!("speechSynthesis" in window)) {
      setVoiceNotice("Speech synthesis is not supported on this device.");
      return;
    }

    window.speechSynthesis.cancel();
    if (!text || text.trim().length === 0) return;

    const utterance = new SpeechSynthesisUtterance(text);
    const langCode = lang === "mr" ? "mr-IN" : lang === "hi" ? "hi-IN" : "en-IN";
    utterance.lang = langCode;
    utterance.rate = 0.88; // Slightly slower for low-literacy comprehension

    const voices = window.speechSynthesis.getVoices();
    
    // 1. Exact match for language
    let chosenVoice = voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith(lang) ||
        v.lang.toLowerCase().replace("_", "-").startsWith(langCode.toLowerCase()) ||
        v.name.toLowerCase().includes(lang === "mr" ? "marathi" : lang === "hi" ? "hindi" : "english")
    );

    // 2. If Marathi is missing, fallback to Hindi (Devanagari phonetics)
    if (!chosenVoice && lang === "mr") {
      chosenVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith("hi") ||
          v.lang.toLowerCase().replace("_", "-").startsWith("hi-in") ||
          v.name.toLowerCase().includes("hindi")
      );
    }

    // 3. If still missing, fallback to Indian English or first available voice
    if (!chosenVoice) {
      chosenVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith("en-in") ||
          v.lang.toLowerCase().includes("india") ||
          v.lang.toLowerCase().startsWith("en")
      ) || voices[0];
    }

    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    if (lang === "mr" && (!chosenVoice || !chosenVoice.lang.toLowerCase().startsWith("mr"))) {
      setVoiceNotice(
        "मराठी आवाज प्रणालीत स्थापित नसल्याने उपलब्ध सिस्टीम आवाजात वाचत आहे."
      );
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeech = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const hasVoiceForLang = useCallback((lang: Language): boolean => {
    if (!("speechSynthesis" in window)) return false;
    const voices = window.speechSynthesis.getVoices();
    const langCode = lang === "mr" ? "mr-IN" : lang === "hi" ? "hi-IN" : "en-IN";
    return voices.some(
      (v) => v.lang.startsWith(lang) || v.lang.replace("_", "-").startsWith(langCode)
    );
  }, []);

  const clearVoiceNotice = () => setVoiceNotice(null);

  return (
    <AccessibilityContext.Provider
      value={{
        textScale,
        setTextScale,
        highContrast,
        setHighContrast,
        toggleHighContrast,
        audioMode,
        setAudioMode,
        toggleAudioMode,
        isSpeaking,
        speak,
        stopSpeech,
        hasVoiceForLang,
        voiceNotice,
        clearVoiceNotice,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return ctx;
};
