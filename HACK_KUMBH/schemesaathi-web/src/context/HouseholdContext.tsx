import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import { offlineStorage } from "../lib/offline-storage";
import { useAuth } from "./AuthContext";
import type { EvaluateResponse } from "../api/types";

interface HouseholdContextValue {
  householdId: string;
  setHouseholdId: (id: string | null) => void;
  memberId: string | null;
  setMemberId: (id: string | null) => void;
  districtId: string;
  setDistrictId: (d: string) => void;
  taluka: string;
  setTaluka: (t: string) => void;
  state: string;
  answers: Record<string, unknown>;
  setAnswer: (key: string, value: unknown) => Promise<void>;
  setBatchAnswers: (newAnswers: Record<string, unknown>) => Promise<void>;
  prefillSource: "digilocker" | "aadhaar_qr" | "manual" | null;
  setPrefillSource: (s: "digilocker" | "aadhaar_qr" | "manual" | null) => void;
  isOffline: boolean;
  isSyncing: boolean;
  consistencyWarnings: string[];
  clearWarnings: () => void;
  resetSession: () => void;
  resetHousehold: () => void;
  claimProfile: (phone: string, consent: { data_processing: boolean; sms_reminders: boolean; volunteer_assist: boolean }) => Promise<string>;
  evaluation: EvaluateResponse | null;
  isLoading: boolean;
  reevaluate: (includeExplore?: boolean) => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useAuth();
  const [householdId, setHouseholdIdState] = useState<string>(() => {
    return localStorage.getItem("schemesaathi_hh_id") || `hh_${Date.now()}`;
  });

  const [memberId, setMemberIdState] = useState<string | null>(() => {
    return localStorage.getItem("schemesaathi_mem_id");
  });

  const [districtId, setDistrictId] = useState<string>(() => {
    return localStorage.getItem("schemesaathi_district") || "DIST_MH_NGP";
  });

  const [taluka, setTaluka] = useState<string>(() => {
    return localStorage.getItem("schemesaathi_taluka") || "Nagpur Urban";
  });

  const [state] = useState<string>("Maharashtra");

  const [answers, setAnswersState] = useState<Record<string, unknown>>(() => {
    try {
      const saved = localStorage.getItem("schemesaathi_answers");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [prefillSource, setPrefillSource] = useState<"digilocker" | "aadhaar_qr" | "manual" | null>(() => {
    return (localStorage.getItem("schemesaathi_prefill_source") as "digilocker" | "aadhaar_qr" | "manual") || null;
  });

  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [consistencyWarnings, setConsistencyWarnings] = useState<string[]>([]);
  const [evaluation, setEvaluation] = useState<EvaluateResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const setHouseholdId = (id: string | null) => {
    const val = id || `hh_${Date.now()}`;
    setHouseholdIdState(val);
    localStorage.setItem("schemesaathi_hh_id", val);
  };

  const setMemberId = (id: string | null) => {
    setMemberIdState(id);
    if (id) localStorage.setItem("schemesaathi_mem_id", id);
    else localStorage.removeItem("schemesaathi_mem_id");
  };

  const reevaluate = useCallback(
    async (includeExplore: boolean = false) => {
      try {
        setIsLoading(true);
        // If answers exist, evaluate stateless or with household
        const res = await api.evaluateStateless({
          answers,
          district_id: districtId,
          include_explore: includeExplore,
        });
        setEvaluation(res);
      } catch (err) {
        console.warn("Re-evaluation failed or offline", err);
      } finally {
        setIsLoading(false);
      }
    },
    [answers, districtId]
  );

  const setAnswer = useCallback(
    async (key: string, value: unknown) => {
      const updated = { ...answers, [key]: value };
      setAnswersState(updated);
      localStorage.setItem("schemesaathi_answers", JSON.stringify(updated));

      if (householdId) {
        if (!navigator.onLine) {
          offlineStorage.enqueue({
            householdId,
            memberId: memberId || undefined,
            answers: { [key]: value },
          });
        } else {
          try {
            const res = await api.patchAnswers(householdId, {
              member_id: memberId || undefined,
              answers: { [key]: value },
              source: role === "volunteer" ? "volunteer_confirmed" : "self_declared",
            });
            if (res.warnings && res.warnings.length > 0) {
              setConsistencyWarnings(res.warnings.map((w) => w.message));
            }
          } catch {
            offlineStorage.enqueue({
              householdId,
              memberId: memberId || undefined,
              answers: { [key]: value },
            });
          }
        }
      }
    },
    [answers, householdId, memberId, role]
  );

  const setBatchAnswers = useCallback(
    async (newAnswers: Record<string, unknown>) => {
      const updated = { ...answers, ...newAnswers };
      setAnswersState(updated);
      localStorage.setItem("schemesaathi_answers", JSON.stringify(updated));

      if (householdId) {
        if (!navigator.onLine) {
          offlineStorage.enqueue({
            householdId,
            memberId: memberId || undefined,
            answers: newAnswers,
          });
        } else {
          try {
            const res = await api.patchAnswers(householdId, {
              member_id: memberId || undefined,
              answers: newAnswers,
              source: role === "volunteer" ? "volunteer_confirmed" : "self_declared",
            });
            if (res.warnings && res.warnings.length > 0) {
              setConsistencyWarnings(res.warnings.map((w) => w.message));
            }
          } catch {
            offlineStorage.enqueue({
              householdId,
              memberId: memberId || undefined,
              answers: newAnswers,
            });
          }
        }
      }
    },
    [answers, householdId, memberId, role]
  );

  const claimProfile = async (
    phone: string,
    consent: { data_processing: boolean; sms_reminders: boolean; volunteer_assist: boolean }
  ): Promise<string> => {
    const claimRes = await api.claimHousehold({
      answers: { ...answers, phone_number: phone },
      consent: {
        data_processing: consent.data_processing,
        sms_reminders: consent.sms_reminders,
        volunteer_assist: consent.volunteer_assist,
      },
      district_id: districtId,
      taluka,
      state,
    });

    setHouseholdId(claimRes.household_id);
    if (claimRes.access_secret) {
      localStorage.setItem("schemesaathi_access_secret", claimRes.access_secret);
    }
    await offlineStorage.flushQueue();
    return claimRes.household_id;
  };

  const resetSession = () => {
    const newId = `hh_${Date.now()}`;
    setHouseholdIdState(newId);
    setMemberIdState(null);
    setAnswersState({});
    setEvaluation(null);
    setPrefillSource(null);
    setConsistencyWarnings([]);
    localStorage.removeItem("schemesaathi_answers");
    localStorage.removeItem("schemesaathi_access_secret");
    localStorage.setItem("schemesaathi_hh_id", newId);
    localStorage.removeItem("schemesaathi_mem_id");
    localStorage.removeItem("schemesaathi_prefill_source");
    offlineStorage.clearQueue();
  };

  const resetHousehold = resetSession;
  const clearWarnings = () => setConsistencyWarnings([]);

  // Auto trigger evaluation on answers change if online
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      reevaluate(false);
    }
  }, [answers, reevaluate]);

  return (
    <HouseholdContext.Provider
      value={{
        householdId,
        setHouseholdId,
        memberId,
        setMemberId,
        districtId,
        setDistrictId,
        taluka,
        setTaluka,
        state,
        answers,
        setAnswer,
        setBatchAnswers,
        prefillSource,
        setPrefillSource,
        isOffline,
        isSyncing,
        consistencyWarnings,
        clearWarnings,
        resetSession,
        resetHousehold,
        claimProfile,
        evaluation,
        isLoading,
        reevaluate,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
};

export const useHousehold = () => {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error("useHousehold must be used within HouseholdProvider");
  return ctx;
};
