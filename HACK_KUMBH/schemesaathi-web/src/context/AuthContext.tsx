import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../api/types";
import { api } from "../api/client";

interface AuthContextValue {
  role: "citizen" | "volunteer" | "admin";
  volunteerKey: string | null;
  adminKey: string | null;
  assistedBy: string | null;
  setVolunteerKey: (key: string, assistedBy?: string) => void;
  setAdminKey: (key: string) => void;
  logoutVolunteer: () => void;
  logoutAdmin: () => void;
  logout: () => void;

  // Citizen User Account State
  user: User | null;
  isAuthenticated: boolean;
  loginCitizen: (username: string, password: string) => Promise<User>;
  registerCitizen: (data: {
    username: string;
    password: string;
    full_name?: string;
    phone?: string;
    email?: string;
  }) => Promise<User>;
  logoutCitizen: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [volunteerKey, setVolunteerKeyState] = useState<string | null>(() => {
    return sessionStorage.getItem("schemesaathi_volunteer_key");
  });

  const [adminKey, setAdminKeyState] = useState<string | null>(() => {
    return sessionStorage.getItem("schemesaathi_admin_key");
  });

  const [assistedBy, setAssistedByState] = useState<string | null>(() => {
    return sessionStorage.getItem("schemesaathi_assisted_by");
  });

  const [user, setUserState] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem("schemesaathi_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const setVolunteerKey = (key: string, assistedByVal?: string) => {
    const trimmed = key.trim();
    if (trimmed) {
      sessionStorage.setItem("schemesaathi_volunteer_key", trimmed);
      setVolunteerKeyState(trimmed);
      if (assistedByVal) {
        sessionStorage.setItem("schemesaathi_assisted_by", assistedByVal.trim());
        setAssistedByState(assistedByVal.trim());
      }
    }
  };

  const setAdminKey = (key: string) => {
    const trimmed = key.trim();
    if (trimmed) {
      sessionStorage.setItem("schemesaathi_admin_key", trimmed);
      setAdminKeyState(trimmed);
    }
  };

  const logoutVolunteer = () => {
    sessionStorage.removeItem("schemesaathi_volunteer_key");
    sessionStorage.removeItem("schemesaathi_assisted_by");
    setVolunteerKeyState(null);
    setAssistedByState(null);
  };

  const logoutAdmin = () => {
    sessionStorage.removeItem("schemesaathi_admin_key");
    setAdminKeyState(null);
  };

  const logoutCitizen = () => {
    localStorage.removeItem("schemesaathi_user");
    localStorage.removeItem("schemesaathi_auth_token");
    localStorage.removeItem("schemesaathi_answers");
    localStorage.removeItem("schemesaathi_prefill_source");
    localStorage.removeItem("schemesaathi_hh_secret");
    setUserState(null);
  };

  const logout = () => {
    logoutVolunteer();
    logoutAdmin();
    logoutCitizen();
  };

  const updateUser = (updated: User) => {
    setUserState(updated);
    localStorage.setItem("schemesaathi_user", JSON.stringify(updated));
  };

  const loginCitizen = async (username: string, password: string): Promise<User> => {
    const res = await api.login({ username, password });
    setUserState(res.user);
    return res.user;
  };

  const registerCitizen = async (data: {
    username: string;
    password: string;
    full_name?: string;
    phone?: string;
    email?: string;
  }): Promise<User> => {
    // Purge old anonymous answers so brand new user starts 100% clean
    localStorage.removeItem("schemesaathi_answers");
    localStorage.removeItem("schemesaathi_prefill_source");
    const res = await api.register(data);
    setUserState(res.user);
    return res.user;
  };

  const role = adminKey ? "admin" : volunteerKey ? "volunteer" : "citizen";
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        role,
        volunteerKey,
        adminKey,
        assistedBy,
        setVolunteerKey,
        setAdminKey,
        logoutVolunteer,
        logoutAdmin,
        logout,
        user,
        isAuthenticated,
        loginCitizen,
        registerCitizen,
        logoutCitizen,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
