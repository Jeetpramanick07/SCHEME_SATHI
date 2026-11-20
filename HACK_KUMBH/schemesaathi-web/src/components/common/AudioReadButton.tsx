import React, { useState, useEffect, useRef } from "react";
import { useAccessibility } from "../../context/AccessibilityContext";
import { useTranslation } from "../../context/I18nContext";
import { Volume2, Square, AlertCircle } from "lucide-react";

interface AudioReadButtonProps {
  text: string;
  schemeId?: string;
  autoPlay?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

export const AudioReadButton: React.FC<AudioReadButtonProps> = ({
  text,
  schemeId,
  autoPlay = false,
  size = "md",
  className = "",
  label,
}) => {
  const { isSpeaking, speak, stopSpeech, audioMode, hasVoiceForLang } = useAccessibility();
  const { language, t } = useTranslation();

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isMockAudio, setIsMockAudio] = useState(false);
  const [noVoiceNotice, setNoVoiceNotice] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stop audio playback when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Auto-read text if audio mode is active
  useEffect(() => {
    if (autoPlay && audioMode && text) {
      handlePlay();
    }
  }, [autoPlay, audioMode, text]);

  const fallbackToBrowserSpeech = () => {
    setNoVoiceNotice(false);
    speak(text, language);
  };

  const handlePlay = async () => {
    // If already playing audio element, stop it
    if (isPlayingAudio && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingAudio(false);
      return;
    }

    // If speaking via browser speechSynthesis, stop it
    if (isSpeaking) {
      stopSpeech();
      return;
    }

    // If schemeId is available, try precomputed audio from backend first
    if (schemeId) {
      const audioUrl = `/api/v1/voice/schemes/${encodeURIComponent(schemeId)}/audio?lang=${language}`;
      try {
        const checkRes = await fetch(audioUrl, { method: "HEAD" });
        if (checkRes.ok) {
          const isMock = checkRes.headers.get("x-mock") === "true";
          const isTone = checkRes.headers.get("x-tone") === "true";

          // Beep Audio Guard: never play mock tone audio as speech; treat as absent & use browser speech synthesis
          if (isMock || isTone) {
            fallbackToBrowserSpeech();
            return;
          }

          const audio = new Audio(audioUrl);
          audioRef.current = audio;

          audio.onplay = () => setIsPlayingAudio(true);
          audio.onended = () => {
            setIsPlayingAudio(false);
            audioRef.current = null;
          };
          audio.onerror = () => {
            setIsPlayingAudio(false);
            audioRef.current = null;
            fallbackToBrowserSpeech();
          };

          await audio.play();
          return;
        }
      } catch {
        // Fallback on network failure
      }
    }

    // Fallback to browser speechSynthesis
    fallbackToBrowserSpeech();
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handlePlay();
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const active = isPlayingAudio || isSpeaking;

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={handleClick}
        type="button"
        className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-all ${
          sizeClasses[size]
        } ${
          active
            ? "bg-amber-600 text-white animate-pulse shadow-md"
            : "bg-blue-100 text-blue-900 hover:bg-blue-200 active:scale-95"
        } ${className}`}
        aria-label={active ? t("accessibility.audio_playing") : t("accessibility.audio_stopped")}
        title={active ? t("accessibility.audio_playing") : t("accessibility.audio_stopped")}
      >
        {active ? (
          <>
            <Square className={iconSizes[size]} />
            <span>{label || t("accessibility.audio_playing")}</span>
          </>
        ) : (
          <>
            <Volume2 className={iconSizes[size]} />
            <span>{label || t("accessibility.audio_stopped")}</span>
          </>
        )}
      </button>

      {/* Visible DEMO VOICE badge if precomputed audio was generated in mock mode */}
      {isMockAudio && (
        <span
          data-testid="demo-voice-badge"
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs"
          title="Generated with synthetic tone / demo voice"
        >
          DEMO VOICE
        </span>
      )}

      {/* No-voice notice when speech synthesis is missing on device */}
      {noVoiceNotice && (
        <span
          role="alert"
          className="inline-flex items-center gap-1 text-xs text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full animate-in fade-in"
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          <span>आवाज उपलब्ध नाही (No voice installed)</span>
        </span>
      )}
    </div>
  );
};
