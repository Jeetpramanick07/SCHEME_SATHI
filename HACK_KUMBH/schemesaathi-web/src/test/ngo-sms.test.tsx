import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { I18nProvider } from "../context/I18nContext";
import { AccessibilityProvider } from "../context/AccessibilityContext";
import { HouseholdProvider } from "../context/HouseholdContext";
import { AuthProvider } from "../context/AuthContext";
import { SimulatedInboxView } from "../components/inbox/SimulatedInboxView";
import { SettingsView } from "../components/settings/SettingsView";
import { NgoDashboard } from "../components/ngo/NgoDashboard";
import { apiClient } from "../api/client";

// Mock API client
vi.mock("../api/client", () => ({
  apiClient: {
    getMeta: vi.fn(),
    getDistrictMetrics: vi.fn(),
    getSimulatedSms: vi.fn(),
    sendTestSms: vi.fn(),
    clearSimulatedSms: vi.fn(),
    deleteHousehold: vi.fn(),
  },
}));

describe("NGO Dashboard & Simulated SMS Frontend Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders SimulatedInboxView with prominent SIMULATED, not sent badge and send test widget", async () => {
    vi.mocked(apiClient.getSimulatedSms).mockResolvedValueOnce({
      provider: "simulated",
      count: 1,
      messages: [
        {
          id: "sms_sim_01",
          household_id: "hh_synth_01",
          phone: "9876500001",
          message: "SchemeSaathi Reminder: Your document renewal is pending. Please visit the local authority office.",
          status: "simulated_delivered",
          provider: "simulated",
          created_at: new Date().toISOString(),
        },
      ],
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <I18nProvider>
            <AccessibilityProvider>
              <HouseholdProvider>
                <SimulatedInboxView />
              </HouseholdProvider>
            </AccessibilityProvider>
          </I18nProvider>
        </AuthProvider>
      </BrowserRouter>
    );

    // Assert prominent badge "SIMULATED, not sent" is visible
    const badge = await screen.findByTestId("simulated-not-sent-badge");
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain("SIMULATED, not sent");

    // Assert send test button is rendered
    const sendBtn = screen.getByTestId("send-test-sms-btn");
    expect(sendBtn).toBeDefined();

    // Assert message card is rendered
    const msgCard = await screen.findByTestId("simulated-sms-card");
    expect(msgCard).toBeDefined();
    expect(msgCard.textContent).toContain("9876500001");
    expect(msgCard.textContent).toContain("SchemeSaathi Reminder");
  });

  it("renders SettingsView with Send test reminder button and link to simulated inbox", () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <I18nProvider>
            <AccessibilityProvider>
              <HouseholdProvider>
                <SettingsView />
              </HouseholdProvider>
            </AccessibilityProvider>
          </I18nProvider>
        </AuthProvider>
      </BrowserRouter>
    );

    const testSmsBtn = screen.getByTestId("send-test-sms-btn");
    expect(testSmsBtn).toBeDefined();
    expect(testSmsBtn.textContent).toContain("Send test reminder");

    const openInboxLink = screen.getByRole("link", { name: /open inbox/i });
    expect(openInboxLink).toBeDefined();
    expect(openInboxLink.getAttribute("href")).toBe("/inbox");
  });

  it("refuses to send test SMS in SettingsView when there is no real household in the session (no silent fallback)", async () => {
    localStorage.clear();
    sessionStorage.clear();

    render(
      <BrowserRouter>
        <AuthProvider>
          <I18nProvider>
            <AccessibilityProvider>
              <HouseholdProvider>
                <SettingsView />
              </HouseholdProvider>
            </AccessibilityProvider>
          </I18nProvider>
        </AuthProvider>
      </BrowserRouter>
    );

    const testSmsBtn = screen.getByTestId("send-test-sms-btn");
    fireEvent.click(testSmsBtn);

    // Must show error message refusing to send
    await waitFor(() => {
      expect(screen.getByText(/No active household in this session/i)).toBeDefined();
    });

    // Proves apiClient.sendTestSms was NEVER called and no silent fallback to seeded household occurred
    expect(apiClient.sendTestSms).not.toHaveBeenCalled();
    expect(localStorage.getItem("schemesaathi_household_id")).toBeNull();
  });

  it("shows the Synthetic demo data banner, district numbers, and synthetic-only toggle on NgoDashboard", async () => {
    // Set admin key in sessionStorage so NgoDashboard doesn't redirect
    sessionStorage.setItem("schemesaathi_admin_key", "admin-secret-key");

    vi.mocked(apiClient.getMeta).mockResolvedValueOnce({
      dataset_version: "v1.0.0",
      synthetic_flags: {
        has_synthetic_schemes: false,
        synthetic_schemes_count: 0,
        has_synthetic_data: true,
        synthetic_households_count: 300,
        synthetic_applications_count: 300,
      },
      counts: {
        total_schemes: 738,
        curated_schemes: 24,
        imported_schemes: 714,
        verified_schemes: 24,
        active_schemes: 738,
      },
      db: "postgres",
      cors_origins: true,
      timestamp: new Date().toISOString(),
    });

    vi.mocked(apiClient.getDistrictMetrics).mockResolvedValue({
      mode: "blended",
      label: "Blended (Real + Synthetic)",
      is_blended: true,
      districts: [
        { district_id: "DIST_MH_NGP", count: 80, synthetic_count: 80, total_count: 80 },
        { district_id: "DIST_MH_AMR", count: 45, synthetic_count: 45, total_count: 45 },
        { district_id: "DIST_MH_CHA", count: 40, synthetic_count: 40, total_count: 40 },
        { district_id: "DIST_MH_WRD", count: 35, synthetic_count: 35, total_count: 35 },
        { district_id: "DIST_MH_YAV", count: 35, synthetic_count: 35, total_count: 35 },
        { district_id: "DIST_MH_BHA", count: 25, synthetic_count: 25, total_count: 25 },
        { district_id: "DIST_MH_GON", count: 25, synthetic_count: 25, total_count: 25 },
        { district_id: "DIST_MH_GAD", count: 15, synthetic_count: 15, total_count: 15 },
      ],
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <I18nProvider>
            <AccessibilityProvider>
              <NgoDashboard />
            </AccessibilityProvider>
          </I18nProvider>
        </AuthProvider>
      </BrowserRouter>
    );

    // Banner must appear when has_synthetic_data is true
    await waitFor(() => {
      const banner = screen.getByTestId("synthetic-demo-banner");
      expect(banner).toBeDefined();
      expect(banner.textContent).toContain("Synthetic demo data");
    });

    // Blended metric label is default
    const blendedLabel = screen.getByTestId("blended-metric-label");
    expect(blendedLabel).toBeDefined();
    expect(blendedLabel.textContent).toBe("Blended (Real + Synthetic)");

    // District cards are visible with non-zero counts
    const nagpurCard = screen.getByTestId("district-card-DIST_MH_NGP");
    expect(nagpurCard).toBeDefined();
    expect(nagpurCard.textContent).toContain("Nagpur");
    expect(nagpurCard.textContent).toContain("80");

    const gadchiroliCard = screen.getByTestId("district-card-DIST_MH_GAD");
    expect(gadchiroliCard).toBeDefined();
    expect(gadchiroliCard.textContent).toContain("Gadchiroli");
    expect(gadchiroliCard.textContent).toContain("15");

    // Toggle to Synthetic Only
    const toggleBtn = screen.getByTestId("synthetic-only-toggle");
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      const synthLabel = screen.getByTestId("synthetic-only-metric-label");
      expect(synthLabel).toBeDefined();
      expect(synthLabel.textContent).toBe("Synthetic Only");
    });
  });
});
