import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../context/I18nContext";
import { AccessibilityProvider } from "../context/AccessibilityContext";
import { AuthProvider } from "../context/AuthContext";
import { HouseholdProvider } from "../context/HouseholdContext";
import { Header } from "../components/layout/Header";
import { StartScreen } from "../components/citizen/StartScreen";
import { ProfileDashboardView } from "../components/citizen/ProfileDashboardView";
import { LoginRegisterModal } from "../components/auth/LoginRegisterModal";

describe("Citizen User Account & Profile Dashboard Suite", () => {
  it("renders Header with profile icon and login trigger", () => {
    render(
      <MemoryRouter>
        <AccessibilityProvider>
          <I18nProvider>
            <AuthProvider>
              <HouseholdProvider>
                <Header />
              </HouseholdProvider>
            </AuthProvider>
          </I18nProvider>
        </AccessibilityProvider>
      </MemoryRouter>
    );

    const profileBtn = screen.getByTestId("profile-icon");
    expect(profileBtn).toBeInTheDocument();
  });

  it("renders LoginRegisterModal with Login and Register tabs", () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <AuthProvider>
            <HouseholdProvider>
              <LoginRegisterModal isOpen={true} onClose={() => {}} defaultTab="login" />
            </HouseholdProvider>
          </AuthProvider>
        </I18nProvider>
      </MemoryRouter>
    );

    const loginBtns = screen.getAllByRole("button", { name: /लॉगिन करा|Login/i });
    expect(loginBtns.length).toBeGreaterThanOrEqual(1);

    const registerBtns = screen.getAllByRole("button", { name: /नवीन नोंदणी|Register/i });
    expect(registerBtns.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByPlaceholderText(/widow_nagpur/i)).toBeInTheDocument();
  });

  it("renders StartScreen with account callout when unauthenticated", () => {
    render(
      <MemoryRouter>
        <AccessibilityProvider>
          <I18nProvider>
            <AuthProvider>
              <HouseholdProvider>
                <StartScreen />
              </HouseholdProvider>
            </AuthProvider>
          </I18nProvider>
        </AccessibilityProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/नवीन किंवा अस्तित्वातील वापरकर्ता\?|New or Existing Citizen User\?/i)).toBeInTheDocument();
    expect(screen.getByText(/मराठी/i)).toBeInTheDocument();
  });

  it("renders ProfileDashboardView with DigiLocker fetch and all form sections", () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <AuthProvider>
            <HouseholdProvider>
              <ProfileDashboardView />
            </HouseholdProvider>
          </AuthProvider>
        </I18nProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/डिजीलॉकरवरून माहिती आणा|Fetch from DigiLocker/i)).toBeInTheDocument();
    expect(screen.getByText(/१\. ओळखपत्र व आधार कार्ड/i)).toBeInTheDocument();
    expect(screen.getByText(/२\. वैयक्तिक माहिती/i)).toBeInTheDocument();
    expect(screen.getByText(/३\. पत्ता व भौगोलिक क्षेत्र/i)).toBeInTheDocument();
    expect(screen.getByText(/४\. आर्थिक व शेती तपशील/i)).toBeInTheDocument();

    const schemeBtns = screen.getAllByText(/माझ्यासाठी योग्य योजना पहा|पात्र योजना पहा/i);
    expect(schemeBtns.length).toBeGreaterThanOrEqual(1);
  });
});
