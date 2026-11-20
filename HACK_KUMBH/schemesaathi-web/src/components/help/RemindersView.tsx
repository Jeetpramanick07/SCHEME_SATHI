import React, { useState, useEffect } from "react";
import { useHousehold } from "../../context/HouseholdContext";
import { useTranslation } from "../../context/I18nContext";
import { apiClient } from "../../api/client";
import { AudioReadButton } from "../common/AudioReadButton";
import { Bell, AlertTriangle, Calendar, Plus, Check } from "lucide-react";

interface Reminder {
  id: string;
  scheme_id?: string;
  reminder_type: string;
  remind_at: string;
  message: string;
  dismissed: boolean;
}

export const RemindersView: React.FC = () => {
  const { householdId } = useHousehold();
  const { t } = useTranslation();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadReminders() {
      try {
        setLoading(true);
        const data = await apiClient.getHouseholdReminders(householdId);
        if (isMounted) setReminders(data as unknown as Reminder[]);
      } catch {
        // demo fallback
        if (isMounted) {
          setReminders([
            {
              id: "rem-1",
              scheme_id: "CENT-MORD-NSAP-006",
              reminder_type: "document_renewal",
              remind_at: new Date(Date.now() + 86400000 * 14).toISOString(),
              message: t("reminder_demo_1"),
              dismissed: false,
            },
          ]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadReminders();
    return () => {
      isMounted = false;
    };
  }, [householdId, t]);

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message || !remindAt) return;

    try {
      const created = await apiClient.createReminder(householdId, {
        reminder_type: "custom",
        remind_at: new Date(remindAt).toISOString(),
        message,
      });
      setReminders((prev) => [created as unknown as Reminder, ...prev]);
      setMessage("");
      setRemindAt("");
      setShowAdd(false);
    } catch {
      // offline fallback
      const local: Reminder = {
        id: `rem-local-${Date.now()}`,
        reminder_type: "custom",
        remind_at: new Date(remindAt).toISOString(),
        message,
        dismissed: false,
      };
      setReminders((prev) => [local, ...prev]);
      setMessage("");
      setRemindAt("");
      setShowAdd(false);
    }
  };

  const handleDismiss = async (remId: string) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === remId ? { ...r, dismissed: true } : r))
    );
    try {
      await apiClient.dismissReminder(remId);
    } catch {
      // offline fallback
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-6 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
              {t("reminders_title")}
            </h1>
            <AudioReadButton text={`${t("reminders_title")}. ${t("sms_not_connected_warning")}`} />
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t("reminders_subtitle")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" />
          {t("add_reminder")}
        </button>
      </div>

      {/* Prominent Banner: SMS not connected yet */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/40">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
            {t("sms_gateway_notice_title")}
          </h3>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            {t("sms_not_connected_warning")}
          </p>
        </div>
      </div>

      {/* Add Reminder Form */}
      {showAdd && (
        <form
          onSubmit={handleAddReminder}
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {t("create_new_reminder")}
          </h3>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase">
                {t("reminder_message")}
              </label>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("reminder_message_placeholder")}
                className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase">
                {t("reminder_date")}
              </label>
              <input
                type="date"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700"
              >
                {t("save_reminder")}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Reminders List */}
      <div className="mt-6 space-y-3">
        {loading && (
          <div className="py-12 text-center text-sm text-slate-500">
            {t("loading_reminders")}...
          </div>
        )}

        {!loading && reminders.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-800">
            {t("no_reminders_set")}
          </div>
        )}

        {reminders.map((rem) => (
          <div
            key={rem.id}
            className={`flex items-start justify-between gap-3 rounded-xl border p-4 transition ${
              rem.dismissed
                ? "border-slate-200 bg-slate-50/50 opacity-60 dark:border-slate-800 dark:bg-slate-900/40"
                : "border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p
                  className={`text-sm font-semibold ${
                    rem.dismissed
                      ? "text-slate-400 line-through"
                      : "text-slate-900 dark:text-white"
                  }`}
                >
                  {rem.message}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(rem.remind_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {!rem.dismissed && (
              <button
                type="button"
                onClick={() => handleDismiss(rem.id)}
                className="min-h-[40px] rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Check className="h-3.5 w-3.5 inline mr-1" />
                {t("mark_done")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
