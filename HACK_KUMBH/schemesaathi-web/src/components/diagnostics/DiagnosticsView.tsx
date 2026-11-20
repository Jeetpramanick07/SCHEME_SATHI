import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../../context/I18nContext";
import { useAccessibility } from "../../context/AccessibilityContext";
import { AudioReadButton } from "../common/AudioReadButton";
import {
  Volume2,
  Mic,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  RefreshCw,
  Play,
  Monitor,
} from "lucide-react";

export const DiagnosticsView: React.FC = () => {
  const { t, language } = useTranslation();
  const { textScale, highContrast } = useAccessibility();

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [testedLang, setTestedLang] = useState<string | null>(null);
  const [speechRecStatus, setSpeechRecStatus] = useState<{
    supported: boolean;
    engine: string;
    isListening: boolean;
    transcript: string;
    error: string | null;
  }>({
    supported: false,
    engine: "None",
    isListening: false,
    transcript: "",
    error: null,
  });

  const loadVoices = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
    }
  };

  useEffect(() => {
    loadVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Check SpeechRecognition
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechRecStatus((prev) => ({
        ...prev,
        supported: true,
        engine: (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition
          ? "webkitSpeechRecognition"
          : "Standard SpeechRecognition",
      }));
    }
  }, []);

  const mrVoices = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith("mr") ||
      v.lang.toLowerCase().replace("_", "-").startsWith("mr-in") ||
      v.name.toLowerCase().includes("marathi")
  );

  const hiVoices = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith("hi") ||
      v.lang.toLowerCase().replace("_", "-").startsWith("hi-in") ||
      v.name.toLowerCase().includes("hindi")
  );

  const enVoices = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith("en") ||
      v.lang.toLowerCase().replace("_", "-").startsWith("en-in") ||
      v.lang.toLowerCase().startsWith("en-")
  );

  const handleTestVoice = (lang: "mr" | "hi" | "en") => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setTestedLang(lang);

    const textMap = {
      mr: "नमस्कार, हे योजनासाथी व्हॉइस चाचणी ऑडिओ आहे.",
      hi: "नमस्ते, यह योजनासाथी वॉयस परीक्षण ऑडियो है।",
      en: "Hello, this is SchemeSaathi voice diagnostic test.",
    };

    const utterance = new SpeechSynthesisUtterance(textMap[lang]);
    utterance.lang = lang === "mr" ? "mr-IN" : lang === "hi" ? "hi-IN" : "en-IN";

    const targetList = lang === "mr" ? mrVoices : lang === "hi" ? hiVoices : enVoices;
    if (targetList.length > 0) {
      utterance.voice = targetList[0];
    }

    utterance.onend = () => setTestedLang(null);
    utterance.onerror = () => setTestedLang(null);
    window.speechSynthesis.speak(utterance);
  };

  const handleTestMic = () => {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRec) return;

    try {
      const recognition = new SpeechRec();
      recognition.lang = language === "mr" ? "mr-IN" : language === "hi" ? "hi-IN" : "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setSpeechRecStatus((prev) => ({
          ...prev,
          isListening: true,
          transcript: "Listening... speak now",
          error: null,
        }));
      };

      recognition.onresult = (event: any) => {
        const text = event.results?.[0]?.[0]?.transcript || "";
        setSpeechRecStatus((prev) => ({
          ...prev,
          isListening: false,
          transcript: text,
        }));
      };

      recognition.onerror = (err: any) => {
        setSpeechRecStatus((prev) => ({
          ...prev,
          isListening: false,
          error: `Recognition error: ${err.error || "Permission or network issue"}`,
        }));
      };

      recognition.onend = () => {
        setSpeechRecStatus((prev) => ({ ...prev, isListening: false }));
      };

      recognition.start();
    } catch (e: any) {
      setSpeechRecStatus((prev) => ({
        ...prev,
        error: e.message || "Failed to start speech recognition",
      }));
    }
  };

  const audioSummary = `${t("diagnostics.title") || "Device Diagnostics"}. Total voices installed: ${voices.length}. Marathi voices: ${mrVoices.length}.`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* Back button */}
      <Link
        to="/questionnaire"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 mb-2"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{t("questionnaire.back") || "Back"}</span>
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            डिव्हाइस आणि ऑडिओ तपासणी / Device Diagnostics
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            SpeechSynthesis, installed voices, and SpeechRecognition availability
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AudioReadButton text={audioSummary} />
          <button
            type="button"
            onClick={loadVoices}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
            title="Reload voices"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Marathi Voice Status Banner */}
      {mrVoices.length === 0 ? (
        <div
          role="alert"
          data-testid="diag-no-mr-voice"
          className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 flex items-start gap-3"
        >
          <AlertTriangle className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h2 className="font-bold uppercase tracking-wider text-amber-900 text-sm">
              मराठी आवाज स्थापित नाही (No Marathi Voice Found)
            </h2>
            <p>
              या डिव्हाइसवर मराठी भाषा उच्चाराचा आवाज आढळला नाही. ऍप डीफॉल्ट सिस्टीम व्हॉइस वापरेल.
            </p>
            <p className="text-slate-600">
              Windows किंवा Android मध्ये: <strong>Settings &gt; Time &amp; Language &gt; Speech &gt; Add voices &gt; Marathi</strong> जोडा.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4 text-emerald-950 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <div className="text-xs">
            <h2 className="font-bold text-sm text-emerald-900">
              मराठी आवाज उपलब्ध आहे ({mrVoices.length} voice{mrVoices.length > 1 ? "s" : ""})
            </h2>
            <p className="text-emerald-800">
              {mrVoices.map((v) => `${v.name} (${v.lang})`).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Voice Inventory Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-blue-700" />
          <span>SpeechSynthesis Voice Inventory ({voices.length} Total)</span>
        </h2>

        {/* 1. Marathi (mr) */}
        <div className="rounded-xl border border-slate-100 p-3.5 bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">1. मराठी (mr / mr-IN)</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  mrVoices.length > 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {mrVoices.length} installed
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleTestVoice("mr")}
              disabled={testedLang === "mr"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold hover:bg-blue-800 disabled:bg-slate-300"
            >
              <Play className="h-3 w-3" />
              <span>{testedLang === "mr" ? "Playing..." : "Test Marathi"}</span>
            </button>
          </div>
          {mrVoices.length > 0 ? (
            <ul className="text-xs text-slate-600 pl-4 list-disc space-y-0.5">
              {mrVoices.map((v, i) => (
                <li key={i}>
                  <strong>{v.name}</strong> [{v.lang}] {v.default ? "• Default" : ""} {v.localService ? "• Local" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 italic">No Marathi voice package detected.</p>
          )}
        </div>

        {/* 2. Hindi (hi) */}
        <div className="rounded-xl border border-slate-100 p-3.5 bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">2. हिन्दी (hi / hi-IN)</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  hiVoices.length > 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {hiVoices.length} installed
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleTestVoice("hi")}
              disabled={testedLang === "hi"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold hover:bg-blue-800 disabled:bg-slate-300"
            >
              <Play className="h-3 w-3" />
              <span>{testedLang === "hi" ? "Playing..." : "Test Hindi"}</span>
            </button>
          </div>
          {hiVoices.length > 0 ? (
            <ul className="text-xs text-slate-600 pl-4 list-disc space-y-0.5">
              {hiVoices.map((v, i) => (
                <li key={i}>
                  <strong>{v.name}</strong> [{v.lang}] {v.default ? "• Default" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 italic">No Hindi voice detected.</p>
          )}
        </div>

        {/* 3. English (en) */}
        <div className="rounded-xl border border-slate-100 p-3.5 bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">3. English (en-IN / en-US / en-GB)</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800">
                {enVoices.length} installed
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleTestVoice("en")}
              disabled={testedLang === "en"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold hover:bg-blue-800 disabled:bg-slate-300"
            >
              <Play className="h-3 w-3" />
              <span>{testedLang === "en" ? "Playing..." : "Test English"}</span>
            </button>
          </div>
          {enVoices.length > 0 && (
            <p className="text-xs text-slate-600">
              Sample: {enVoices.slice(0, 3).map((v) => v.name).join(", ")}
              {enVoices.length > 3 ? ` (+${enVoices.length - 3} more)` : ""}
            </p>
          )}
        </div>
      </div>

      {/* SpeechRecognition Diagnostics Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Mic className="h-5 w-5 text-indigo-700" />
          <span>SpeechRecognition (Voice Input) Availability</span>
        </h2>

        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">API Status:</span>
              {speechRecStatus.supported ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" />
                  Available ({speechRecStatus.engine})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full">
                  <XCircle className="h-3 w-3" />
                  Not Supported
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Supports yes/no and numeric answers without typing.
            </p>
          </div>

          {speechRecStatus.supported && (
            <button
              type="button"
              onClick={handleTestMic}
              disabled={speechRecStatus.isListening}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 text-white ${
                speechRecStatus.isListening ? "bg-amber-600 animate-pulse" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              <span>{speechRecStatus.isListening ? "Listening..." : "Test Mic"}</span>
            </button>
          )}
        </div>

        {speechRecStatus.transcript && (
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs">
            <span className="font-bold text-indigo-900">Detected: </span>
            <span className="text-indigo-800 font-mono">{speechRecStatus.transcript}</span>
          </div>
        )}

        {speechRecStatus.error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
            {speechRecStatus.error}
          </div>
        )}
      </div>

      {/* Screen & Accessibility Diagnostics */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-slate-700" />
          <span>Display &amp; Accessibility Metrics</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block font-medium">Text Scale:</span>
            <strong className="text-slate-800 text-sm">{textScale}</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block font-medium">High Contrast:</span>
            <strong className="text-slate-800 text-sm">{highContrast ? "Enabled" : "Disabled"}</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block font-medium">Window Width:</span>
            <strong className="text-slate-800 text-sm">{window.innerWidth}px</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block font-medium">Active Language:</span>
            <strong className="text-slate-800 text-sm">{language}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};