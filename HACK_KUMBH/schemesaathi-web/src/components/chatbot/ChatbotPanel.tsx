import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "../../context/I18nContext";
import { useHousehold } from "../../context/HouseholdContext";
import { useAccessibility } from "../../context/AccessibilityContext";
import { apiClient } from "../../api/client";
import {
  MessageSquare,
  Send,
  Check,
  X,
  Bot,
  Sparkles,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  Building2,
  Layers,
  Keyboard,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { Language } from "../../api/types";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  proposedAnswer?: { key: string; value: unknown; label: string };
  links?: Array<{ title: string; url: string }>;
  faqs?: Array<{ question: string; answer: string }>;
}

export const ChatbotPanel: React.FC = () => {
  const isEnabled = import.meta.env.VITE_ENABLE_CHATBOT !== "false";
  const { t, language, setLanguage } = useTranslation();
  const { setAnswer } = useHousehold();
  const { speak, stopSpeech, isSpeaking } = useAccessibility();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [useVoiceMode, setUseVoiceMode] = useState(true);
  const [activeSpeechMsgId, setActiveSpeechMsgId] = useState<string | null>(null);
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "msg_init",
      sender: "bot",
      text:
        language === "mr"
          ? "नमस्ते! मी तुमचा Sarkari Sahayak (सरकारी सहायक) आहे. तुम्हाला कोणत्या योजनेबद्दल माहिती हवी आहे?"
          : language === "hi"
          ? "नमस्ते! मैं आपका Sarkari Sahayak सहायक हूँ। आपको किस बारे में जानना है?"
          : "Namaste! I am your Sarkari Sahayak Assistant. How can I help you with government schemes today?",
      links: [
        { title: "आपले सरकार महाऑनलाइन (Aaple Sarkar)", url: "https://aaplesarkar.mahaonline.gov.in/" },
        { title: "Government of India myScheme Portal", url: "https://www.myscheme.gov.in/" },
      ],
    },
  ]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setRecognitionSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
          handleSend(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang =
        language === "mr" ? "mr-IN" : language === "hi" ? "hi-IN" : "en-IN";
    }
  }, [language]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert(
        language === "mr"
          ? "तुमच्या ब्राऊझरमध्ये व्हॉइस इनपुट उपलब्ध नाही. कृपया टाइप करा."
          : "Voice recognition is not supported in this browser. Please type your query."
      );
      setUseVoiceMode(false);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.lang =
          language === "mr" ? "mr-IN" : language === "hi" ? "hi-IN" : "en-IN";
        recognitionRef.current.start();
      } catch {
        setIsListening(false);
      }
    }
  };

  const handleToggleSpeak = (msgId: string, text: string) => {
    if (isSpeaking && activeSpeechMsgId === msgId) {
      stopSpeech();
      setActiveSpeechMsgId(null);
    } else {
      stopSpeech();
      setActiveSpeechMsgId(msgId);
      const cleanText = text.replace(/[*_#]/g, "").replace(/https?:\/\/\S+/g, "");
      speak(cleanText, language);
    }
  };

  if (!isEnabled) {
    return null;
  }

  const handleSend = async (textToSend?: string) => {
    const userText = (textToSend || input).trim();
    if (!userText) return;

    setInput("");
    const userMsgId = `user_${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, sender: "user", text: userText }]);

    let databaseFaqs: Array<{ question: string; answer: string }> = [];
    try {
      const faqResults = await apiClient.getFaqs(userText);
      if (Array.isArray(faqResults) && faqResults.length > 0) {
        databaseFaqs = faqResults.slice(0, 3).map((f: any) => ({
          question: f.question,
          answer: f.answer,
        }));
      }
    } catch {}

    setTimeout(() => {
      let botReply = "";
      let proposal: { key: string; value: unknown; label: string } | undefined;
      let links: Array<{ title: string; url: string }> = [];

      const lower = userText.toLowerCase();

      if (
        lower.includes("widow") ||
        lower.includes("विधवा") ||
        lower.includes("निराधार") ||
        lower.includes("पतीचा मृत्यू") ||
        lower.includes("sanjay gandhi")
      ) {
        botReply =
          language === "mr"
            ? "विधवांसाठी प्रमुख २ शासकीय योजना आहेत:\n• १) संजय गांधी निराधार अनुदान योजना: दरमहा ₹१,५०० आर्थिक सहाय्य (वार्षिक उत्पन्न मर्यादा ₹२१,०००).\n• २) इंदिरा गांधी राष्ट्रीय विधवा निवृत्तीवेतन (IGNOAPS): दरमहा ₹१,०००-₹१,५०० केंद्र व राज्य सहाय्य.\n\nआवश्यक कागदपत्रे: पतीचा मृत्यू दाखला, तहसीलदार उत्पन्न दाखला, रेशन कार्ड, व बँक पासबुक."
            : language === "hi"
            ? "विधवा महिलाओं के लिए 2 प्रमुख योजनाएं हैं:\n• 1) संजय गांधी निराधार अनुदान योजना: ₹1,500 प्रति माह आर्थिक सहायता।\n• 2) इंदिरा गांधी राष्ट्रीय विधवा पेंशन योजना (IGNOAPS): ₹1,000-₹1,500 प्रति माह।"
            : "For widows, there are 2 flagship schemes in Maharashtra:\n1. Sanjay Gandhi Niradhar Yojana (₹1,500/month)\n2. Indira Gandhi National Widow Pension Scheme (NSAP).\nRequired docs: Spouse Death Certificate, Income Certificate (<₹21k), BPL/Orange Ration Card, Bank Passbook.";
        proposal = {
          key: "is_widow",
          value: true,
          label: language === "mr" ? "माहिती जतन करा: विधवा = होय" : "Save: Widow = Yes",
        };
        links = [
          { title: "Aaple Sarkar Portal", url: "https://aaplesarkar.mahaonline.gov.in/" },
          { title: "National Social Assistance Programme", url: "https://nsap.nic.in/" },
        ];
      } else if (
        lower.includes("ladki") ||
        lower.includes("लाडकी") ||
        lower.includes("बहिन") ||
        lower.includes("बहीण") ||
        lower.includes("1500")
      ) {
        botReply =
          language === "mr"
            ? "मुख्यमंत्री माझी लाडकी बहीण योजना (महाराष्ट्र):\n• लाभ: २१ ते ६५ वयोगटातील पात्र महिलांना दरमहा ₹१,५०० थेट बँक खात्यात (डीबीटी).\n• पात्रता: कुटुंबाचे वार्षिक उत्पन्न ₹२.५० लाखांपेक्षा कमी असावे आणि महाराष्ट्रातील अधिवास असावा.\n• अर्ज पद्धत: नारीशक्ती दूत ॲप, आपले सरकार सेवा केंद्र किंवा अंगणवाडी."
            : language === "hi"
            ? "मुख्यमंत्री माझी लाडकी बहिन योजना (महाराष्ट्र):\n• 21 से 65 वर्ष की महिलाओं को ₹1,500 प्रति माह सहायता।\n• पारिवारिक आय ₹2.5 लाख से कम होनी चाहिए।"
            : "Mukhyamantri Majhi Ladki Bahin Yojana provides ₹1,500/month to women aged 21-65 with family income under ₹2.5 Lakhs.";
        links = [{ title: "Ladki Bahin Official Portal", url: "https://ladakibahin.maharashtra.gov.in/" }];
      } else if (
        lower.includes("kisan") ||
        lower.includes("किसान") ||
        lower.includes("शेतकरी") ||
        lower.includes("farmer") ||
        lower.includes("namo shetkari")
      ) {
        botReply =
          language === "mr"
            ? "शेतकऱ्यांसाठी कल्याणकारी योजना:\n• १) PM-Kisan सन्मान निधी: वर्षाला ₹६,००० (३ हप्त्यांमध्ये ₹२,०००).\n• २) नमो शेतकरी महासन्मान निधी: महाराष्ट्र शासनाकडून अतिरिक्त ₹६,००० (एकूण ₹१२,००० वार्षिक).\n• आवश्यक: ७/१२ उतारा, आधार-बँक NPCI सीडिंग, ई-केवायसी."
            : language === "hi"
            ? "किसानों के लिए योजनाएं:\n• PM-Kisan: ₹6,000/वर्ष + नमो शेतकरी: ₹6,000/वर्ष = कुल ₹12,000 सालाना।"
            : "PM-Kisan (₹6,000/yr) + Namo Shetkari Mahasanman (₹6,000/yr) = ₹12,000/year for eligible land-holding farmers.";
        links = [{ title: "PM-Kisan Official Portal", url: "https://pmkisan.gov.in/" }];
      } else if (
        lower.includes("health") ||
        lower.includes("आरोग्य") ||
        lower.includes("उपचार") ||
        lower.includes("pmjay") ||
        lower.includes("आयुष्मान") ||
        lower.includes("hospital")
      ) {
        botReply =
          language === "mr"
            ? "आरोग्य व मोफत उपचार योजना:\n• १) आयुष्मान भारत PM-JAY: प्रति कुटुंब दरवर्षी ₹५ लाखांपर्यंत मोफत कॅशलेस उपचार.\n• २) महात्मा ज्योतिराव फुले जन आरोग्य योजना (MJPJAY): महाराष्ट्रातील सर्व शिधापत्रिकाधारक कुटुंबांसाठी ₹५ लाखांपर्यंत कॅशलेस उपचार."
            : "Ayushman Bharat PM-JAY & MJPJAY offer up to ₹5 Lakhs cashless health cover per family per year.";
        links = [
          { title: "NHA PM-JAY Beneficiary Portal", url: "https://beneficiary.nha.gov.in/" },
          { title: "MJPJAY Maharashtra Portal", url: "https://www.jeevandayee.gov.in/" },
        ];
      } else if (
        lower.includes("document") ||
        lower.includes("कागदपत्र") ||
        lower.includes("दस्तावेज") ||
        lower.includes("list") ||
        lower.includes("सूची")
      ) {
        botReply =
          language === "mr"
            ? "सरकारी योजनांसाठी लागणारी ५ प्रमुख मूळ कागदपत्रे:\n1. आधार कार्ड (मोबाईल व बँकेशी जोडलेले)\n2. तहसीलदार वार्षिक उत्पन्न दाखला\n3. महाराष्ट्र अधिवास दाखला (१५ वर्षे)\n4. रेशन कार्ड (पिवळे/केशरी)\n5. राष्ट्रीयकृत बँक पासबुक (NPCI Active)."
            : "Top 5 prerequisite documents for welfare schemes: Aadhaar Card, Income Certificate, Domicile Certificate, Ration Card, Bank Passbook with NPCI.";
      } else if (
        lower.includes("bank") ||
        lower.includes("खाते") ||
        lower.includes("खाता") ||
        lower.includes("npci") ||
        lower.includes("link")
      ) {
        botReply =
          language === "mr"
            ? "बँक खाते आधारशी NPCI मॅप कसे करावे:\n१) आपल्या बँकेच्या शाखेत किंवा पोस्ट ऑफिस (IPPB) मध्ये जा.\n२) 'Aadhaar Seeding / DBT Consent Form' भरा.\n३) बायोमेट्रिक फिंगरप्रिंट देऊन NPCI मॅपिंग तात्काळ सक्रिय करा."
            : "To link bank account with NPCI for DBT: Visit your bank branch or Post Office IPPB and submit the Aadhaar Seeding / DBT Consent form with biometric verification.";
      } else if (
        lower.includes("status") ||
        lower.includes("मागोवा") ||
        lower.includes("स्थिति") ||
        lower.includes("track")
      ) {
        botReply =
          language === "mr"
            ? "तुमच्या अर्जांची स्थिती तपासण्यासाठी 'Track Application' (अर्जाचा मागोवा) टॅबवर जा. तेथे तुम्ही सुरू केलेले सर्व अर्ज आणि एसएमएस अपडेट्स पाहू शकता."
            : "To track your application status, visit the 'Track Application' tab in the bottom navigation.";
        links = [{ title: "SchemeSaathi Tracker", url: "/applications" }];
      } else {
        botReply =
          language === "mr"
            ? `तुमच्या प्रश्नासाठी धन्यवाद! तुम्ही 'पात्रता तपासा' (Check Eligibility) बटण दाबून तुमच्या वयानुसार, उत्पन्नानुसार व जातीनुसार योग्य योजना शोधू शकता. खालील त्वरित प्रश्नांपैकी एक निवडा.`
            : `Thank you for your question! You can check all eligible schemes matching your profile by tapping Check Eligibility.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `bot_${Date.now()}`,
          sender: "bot",
          text: botReply,
          proposedAnswer: proposal,
          links,
          faqs: databaseFaqs,
        },
      ]);
    }, 400);
  };

  const handleConfirmProposal = async (proposal: { key: string; value: unknown; label: string }) => {
    await setAnswer(proposal.key, proposal.value);
    setMessages((prev) => [
      ...prev,
      {
        id: `bot_ack_${Date.now()}`,
        sender: "bot",
        text:
          language === "mr"
            ? `✓ ${proposal.label} तुमच्या प्रोफाइलमध्ये यशस्वीपणे नोंदवले गेले!`
            : `✓ ${proposal.label} recorded in your profile!`,
      },
    ]);
  };

  const quickPrompts = [
    {
      mr: "मला कोणती योजना मिळू शकते?",
      hi: "मुझे कौन सी योजना मिल सकती है?",
      en: "Which schemes am I eligible for?",
    },
    {
      mr: "माझ्या अर्जाची स्थिती काय आहे?",
      hi: "मेरी आवेदन स्थिति क्या है?",
      en: "What is my application status?",
    },
    {
      mr: "कागदपत्रांची यादी सांगा",
      hi: "दस्तावेजों की सूची बताएं",
      en: "Tell me list of documents",
    },
    {
      mr: "बँक अकाउंट कसे लिंक करावे?",
      hi: "बैंक अकाउंट कैसे लिंक करें?",
      en: "How to link bank account?",
    },
  ];

  return (
    <div className="relative">
      {/* 2_Home.png & 7_Sahayak_Assistant.png FLOATING ACTION BUTTON */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[#4F7B55] hover:bg-[#3F6444] text-white shadow-xl transition-all hover:scale-105 active:scale-95 border-2 border-white ring-4 ring-[#4F7B55]/20"
          aria-label="Open Sarkari Sahayak Assistant"
        >
          <MessageSquare className="w-7 h-7" />
          <span className="sr-only">Open Chatbot</span>
        </button>
      )}

      {/* 7_Sahayak_Assistant.png CHAT WINDOW MODAL */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Sarkari Sahayak Assistant"
          className={`fixed z-50 bottom-0 sm:bottom-6 right-0 sm:right-6 w-full ${
            isExpanded
              ? "sm:w-[600px] h-full sm:h-[680px]"
              : "sm:w-[420px] md:w-[460px] h-[92vh] sm:h-[580px]"
          } bg-[#FAF7F2] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#E8DFD5] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5`}
        >
          {/* Header matching 7_Sahayak_Assistant.png */}
          <div className="bg-white px-4 py-3 border-b border-[#E8DFD5] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-[#FAF7F2] text-[#6B5E55] transition-colors"
                title="Back / Close"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-sm font-black text-[#2D231E] leading-tight">
                  Sarkari Sahayak Assistant
                </h3>
                <span className="text-[10px] font-bold text-[#4F7B55] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4F7B55] animate-ping" />
                  <span>Online Assistant</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Language Switch Pills matching 7_Sahayak_Assistant.png */}
              <div className="flex items-center bg-[#FAF7F2] p-0.5 rounded-xl border border-[#E8DFD5]">
                {(["hi", "mr"] as Language[]).map((l) => (
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

              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="hidden sm:inline-flex p-1 text-[#6B5E55] hover:text-[#2D231E]"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs bg-[#FAF7F2]">
            {/* Friendly Robot Avatar greeting banner */}
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#EBF2EC] text-[#4F7B55] flex items-center justify-center flex-shrink-0 shadow-xs border border-[#CADBCB]">
                <Bot className="w-5 h-5" />
              </div>
              <div className="bg-white rounded-2xl rounded-tl-none p-3.5 border border-[#E8DFD5] shadow-xs max-w-[85%] text-[#2D231E] leading-relaxed">
                <p className="font-semibold">{messages[0]?.text}</p>
              </div>
            </div>

            {/* Quick suggested prompt pills with chevron matching 7_Sahayak_Assistant.png */}
            {messages.length === 1 && (
              <div className="space-y-2 pt-2">
                {quickPrompts.map((q, idx) => {
                  const text = language === "mr" ? q.mr : language === "hi" ? q.hi : q.en;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(text)}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-white border border-[#E8DFD5] hover:border-[#C4714A] hover:bg-[#FAF7F2] text-left text-xs font-bold text-[#2D231E] shadow-xs transition-all group"
                    >
                      <span>{text}</span>
                      <ChevronRight className="w-4 h-4 text-[#8C7E74] group-hover:text-[#C4714A] group-hover:translate-x-0.5 transition-all" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Render Subsequent Messages */}
            {messages.slice(1).map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 leading-relaxed font-medium shadow-xs ${
                    msg.sender === "user"
                      ? "bg-[#C4714A] text-white rounded-br-none font-semibold"
                      : "bg-white text-[#2D231E] border border-[#E8DFD5] rounded-bl-none"
                  }`}
                >
                  {msg.sender === "bot" && (
                    <div className="flex items-center justify-between border-b border-[#E8DFD5] pb-1.5 mb-2">
                      <span className="text-[10px] font-bold text-[#8C7E74]">Sarkari Sahayak</span>
                      <button
                        type="button"
                        onClick={() => handleToggleSpeak(msg.id, msg.text)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                          activeSpeechMsgId === msg.id && isSpeaking
                            ? "bg-rose-100 text-rose-700 animate-pulse"
                            : "bg-[#FAF7F2] text-[#6B5E55] hover:text-[#C4714A]"
                        }`}
                      >
                        {activeSpeechMsgId === msg.id && isSpeaking ? (
                          <>
                            <VolumeX className="w-3 h-3 text-rose-600" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3 text-[#4F7B55]" />
                            <span>Listen</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  <p className="whitespace-pre-line">{msg.text}</p>

                  {/* Proposed Profile Answer Button */}
                  {msg.proposedAnswer && (
                    <div className="mt-3 rounded-xl bg-[#FDF4E7] p-2.5 border border-[#F4DEC3]">
                      <button
                        type="button"
                        onClick={() => handleConfirmProposal(msg.proposedAnswer!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#4F7B55] hover:bg-[#3F6444] text-white font-bold text-xs shadow-xs active:scale-95 transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{msg.proposedAnswer.label}</span>
                      </button>
                    </div>
                  )}

                  {/* Links */}
                  {msg.links && msg.links.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-[#E8DFD5] space-y-1">
                      {msg.links.map((link, lIdx) => (
                        <a
                          key={lIdx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[#C4714A] hover:underline font-bold text-[11px]"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span className="truncate">{link.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Voice / Keyboard Footer matching 7_Sahayak_Assistant.png */}
          <div className="p-3 bg-white border-t border-[#E8DFD5]">
            {useVoiceMode ? (
              /* Big Circular Voice Control matching 7_Sahayak_Assistant.png */
              <div className="flex flex-col items-center justify-center py-2 space-y-2 relative">
                {/* Switch to keyboard on left */}
                <button
                  type="button"
                  onClick={() => setUseVoiceMode(false)}
                  className="absolute left-2 top-4 p-2 rounded-xl bg-[#FAF7F2] text-[#6B5E55] hover:text-[#2D231E] border border-[#E8DFD5]"
                  title="Switch to Keyboard Input"
                >
                  <Keyboard className="w-5 h-5" />
                </button>

                {/* Big Circular Microphone in TAN #C4714A */}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`w-16 h-16 rounded-full bg-[#C4714A] hover:bg-[#B05E38] text-white flex items-center justify-center shadow-lg transition-all active:scale-95 ${
                    isListening ? "ring-8 ring-[#C4714A]/30 animate-pulse scale-105" : "ring-4 ring-[#C4714A]/10"
                  }`}
                  aria-label="Tap to speak"
                >
                  {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                </button>
                <span className="text-xs font-bold text-[#6B5E55]">
                  {isListening
                    ? (language === "mr" ? "ऐकत आहे... बोला!" : "Listening... Speak now!")
                    : (language === "mr" ? "बोलण्यासाठी दाबा (Tap to speak)" : "Tap to speak")}
                </span>
              </div>
            ) : (
              /* Keyboard Input Form */
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => setUseVoiceMode(true)}
                  className="p-2.5 rounded-xl bg-[#FAF7F2] text-[#C4714A] border border-[#E8DFD5]"
                  title="Switch to Voice Mode"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    language === "mr"
                      ? "प्रश्न विचारा (उदा. पेन्शन, लाडकी बहीण)..."
                      : "Ask question about schemes..."
                  }
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#E8DFD5] bg-white text-[#2D231E] text-xs font-semibold focus:border-[#C4714A] focus:ring-1 focus:ring-[#C4714A] shadow-xs"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-2.5 rounded-xl bg-[#C4714A] hover:bg-[#B05E38] text-white disabled:opacity-40 transition shadow-xs"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
