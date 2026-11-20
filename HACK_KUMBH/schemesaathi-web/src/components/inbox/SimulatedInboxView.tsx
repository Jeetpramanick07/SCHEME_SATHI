import React, { useState, useEffect } from "react";
import { useTranslation } from "../../context/I18nContext";
import { useHousehold } from "../../context/HouseholdContext";
import { apiClient } from "../../api/client";
import { AudioReadButton } from "../common/AudioReadButton";
import { SimulatedSmsItem } from "../../api/types";
import {
  MessageSquare,
  AlertTriangle,
  Send,
  Trash2,
  RefreshCw,
  Phone,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export const SimulatedInboxView: React.FC = () => {
  const { t, language } = useTranslation();
  const { householdId } = useHousehold();

  const [messages, setMessages] = useState<SimulatedSmsItem[]>([]);
  const [provider, setProvider] = useState<string>("simulated");
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getSimulatedSms();
      setMessages(data.messages);
      setProvider(data.provider);
    } catch (err) {
      console.error("Failed to load simulated SMS messages", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setFeedback(null);

    try {
      const targetPhone = phoneInput ? phoneInput.replace(/\D/g, "") : undefined;
      await apiClient.sendTestSms({
        household_id: householdId || undefined,
        to: targetPhone,
        lang: language,
      });

      setFeedback({
        type: "success",
        text: "Test reminder created in SIMULATED inbox (not sent to carrier networks).",
      });
      setPhoneInput("");
      await fetchMessages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send test reminder";
      setFeedback({ type: "error", text: msg });
    } finally {
      setIsSending(false);
    }
  };

  const handleClearInbox = async () => {
    if (!window.confirm("Clear all simulated SMS messages?")) return;
    try {
      await apiClient.clearSimulatedSms();
      setMessages([]);
      setFeedback({ type: "success", text: "Simulated inbox cleared." });
    } catch (err) {
      console.error("Failed to clear inbox", err);
    }
  };

  const audioSummary = `Simulated SMS Inbox. Prominently labelled SIMULATED, not sent. ${messages.length} messages received.`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Top Banner: SIMULATED, not sent */}
      <div
        data-testid="simulated-not-sent-banner"
        className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-5 shadow-sm dark:border-amber-700 dark:bg-amber-950/40"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              data-testid="simulated-not-sent-badge"
              className="rounded-full bg-amber-500 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-white shadow-sm"
            >
              SIMULATED, not sent
            </span>
            <div>
              <h2 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                SMS Provider: <span className="font-mono uppercase">{provider}</span>
              </h2>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                These notifications are displayed in-app for demonstration and local testing. No live carrier SMS or network charges occurred.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchMessages}
            disabled={loading}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Header */}
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-6 dark:border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
              SMS Inbox (Simulated)
            </h1>
            <AudioReadButton text={audioSummary} />
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Audit log of citizen and volunteer SMS notification alerts.
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClearInbox}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Trash2 className="h-4 w-4 text-rose-500" />
            Clear Inbox
          </button>
        )}
      </div>

      {/* Send Test Reminder Widget */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Send className="h-4 w-4 text-emerald-600" />
          Send Test SMS Reminder
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Dispatches a localized test reminder. Strictly verifies active consent and valid 10-digit phone format.
        </p>

        <form onSubmit={handleSendTest} className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="tel"
              data-testid="inbox-test-phone-input"
              placeholder="10-digit mobile number (e.g. 9876500001)"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <button
            type="submit"
            data-testid="send-test-sms-btn"
            disabled={isSending}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            <Send className="h-4 w-4" />
            {isSending ? "Sending..." : "Send Test Reminder"}
          </button>
        </form>

        {feedback && (
          <div
            className={`mt-4 rounded-xl p-3 text-xs font-semibold ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
            }`}
          >
            {feedback.text}
          </div>
        )}
      </div>

      {/* Message List */}
      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            Loading simulated notifications...
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <MessageSquare className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
            <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
              No simulated messages yet
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Click &quot;Send test reminder&quot; above or in Settings to generate a simulated SMS alert.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              data-testid="simulated-sms-card"
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-emerald-600" />
                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                    +91 {msg.phone}
                  </span>
                  <span
                    data-testid="simulated-badge"
                    className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                  >
                    SIMULATED
                  </span>
                  {msg.status === "simulated_fallback" && (
                    <span
                      data-testid="simulated-fallback-badge"
                      className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-800 dark:bg-rose-900/60 dark:text-rose-200"
                    >
                      SIMULATED FALLBACK
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{new Date(msg.created_at).toLocaleString()}</span>
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                {msg.message}
              </p>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-50 dark:border-slate-800/60">
                <span
                  data-testid="simulated-status"
                  className={`flex items-center gap-1.5 font-semibold ${
                    msg.status === "simulated_fallback"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Status: {msg.status === "simulated_fallback" ? "SIMULATED FALLBACK" : "SIMULATED DELIVERY"}
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  ID: {msg.id}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
