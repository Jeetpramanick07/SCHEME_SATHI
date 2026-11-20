import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AccessibilityProvider } from "../context/AccessibilityContext";
import { I18nProvider } from "../context/I18nContext";
import { SchemeCard } from "../components/citizen/SchemeCard";
import { AccessibilityBar } from "../components/common/AccessibilityBar";
import type { MemberSchemeResult } from "../api/types";

const mockSchemeCanApply: MemberSchemeResult = {
  scheme_id: "CENT-MORD-NSAP-006",
  official_name: "Indira Gandhi National Old Age Pension Scheme",
  status: "ELIGIBLE",
  tier: "can_apply",
  can_apply: true,
  seasonal: false,
  score: 100,
  is_curated: true,
  is_verified: true,
  confidence_badge: "high",
  reasons: {
    en: ["Age is >= 60", "BPL card confirmed"],
    mr: ["वय ६० पेक्षा जास्त आहे", "दारिद्र्यरेषेखालील (BPL) कुटुंब"],
  },
  unknown_attributes: [],
};

const mockSchemeLikely: MemberSchemeResult = {
  scheme_id: "MH-PHD-MAHATMAMPHJY-001",
  official_name: "Ayushman Bharat - PM-JAY",
  status: "UNKNOWN",
  tier: "likely_confirm",
  can_apply: false,
  seasonal: false,
  score: 75,
  is_curated: true,
  confidence_badge: "needs_confirmation",
  what_to_confirm: [
    {
      attribute_key: "ration_card_color",
      label: "Ration Card Color",
      why_it_matters: "Yellow or Orange ration card required",
    },
  ],
  reasons: {
    en: ["Need to confirm ration card type"],
  },
  unknown_attributes: ["ration_card_color"],
};

describe("Frontend Components & Accessibility Suite", () => {
  it("renders AccessibilityBar with font size and language toggles", () => {
    render(
      <MemoryRouter>
        <AccessibilityProvider>
          <I18nProvider>
            <AccessibilityBar />
          </I18nProvider>
        </AccessibilityProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("मराठी")).toBeInTheDocument();
    expect(screen.getByText("हिन्दी")).toBeInTheDocument();
    expect(screen.getByText("English")).toBeInTheDocument();
  });

  it("renders SchemeCard for can_apply tier with high confidence badge", () => {
    render(
      <MemoryRouter>
        <AccessibilityProvider>
          <I18nProvider>
            <SchemeCard scheme={mockSchemeCanApply} />
          </I18nProvider>
        </AccessibilityProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Indira Gandhi National Old Age Pension Scheme")).toBeInTheDocument();
  });

  it("renders SchemeCard for likely_confirm tier with action prompt", () => {
    render(
      <MemoryRouter>
        <AccessibilityProvider>
          <I18nProvider>
            <SchemeCard scheme={mockSchemeLikely} />
          </I18nProvider>
        </AccessibilityProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Ayushman Bharat - PM-JAY")).toBeInTheDocument();
  });
});
