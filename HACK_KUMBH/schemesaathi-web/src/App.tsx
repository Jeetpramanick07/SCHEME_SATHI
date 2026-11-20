import React from "react";
import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { StartScreen } from "./components/citizen/StartScreen";
import { QuestionnaireView } from "./components/citizen/QuestionnaireView";
import { ResultsView } from "./components/citizen/ResultsView";
import { SaveClaimFlow } from "./components/citizen/SaveClaimFlow";
import { DocumentPlanView } from "./components/citizen/DocumentPlanView";
import { ApplicationStepper } from "./components/citizen/ApplicationStepper";
import { ApplicationsListView } from "./components/citizen/ApplicationsListView";
import { DiagnosticsView } from "./components/diagnostics/DiagnosticsView";
import { HelpCentresView } from "./components/help/HelpCentresView";
import { FaqView } from "./components/help/FaqView";
import { RemindersView } from "./components/help/RemindersView";
import { VolunteerLogin } from "./components/volunteer/VolunteerLogin";
import { VolunteerDashboard } from "./components/volunteer/VolunteerDashboard";
import { NgoLogin } from "./components/ngo/NgoLogin";
import { NgoDashboard } from "./components/ngo/NgoDashboard";
import { SettingsView } from "./components/settings/SettingsView";
import { SimulatedInboxView } from "./components/inbox/SimulatedInboxView";
import { ChatbotPanel } from "./components/chatbot/ChatbotPanel";
import { ProfileDashboardView } from "./components/citizen/ProfileDashboardView";

export const App: React.FC = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<StartScreen />} />
          <Route path="questionnaire" element={<QuestionnaireView />} />
          <Route path="results" element={<ResultsView />} />
          <Route path="claim" element={<SaveClaimFlow />} />
          <Route path="document-plan" element={<DocumentPlanView />} />
          <Route path="applications" element={<ApplicationsListView />} />
          <Route path="applications/:id" element={<ApplicationStepper />} />
          <Route path="diagnostics" element={<DiagnosticsView />} />
          <Route path="help-centres" element={<HelpCentresView />} />
          <Route path="faqs" element={<FaqView />} />
          <Route path="reminders" element={<RemindersView />} />
          <Route path="volunteer" element={<VolunteerDashboard />} />
          <Route path="volunteer/login" element={<VolunteerLogin />} />
          <Route path="ngo" element={<NgoDashboard />} />
          <Route path="ngo/login" element={<NgoLogin />} />
          <Route path="settings" element={<SettingsView />} />
          <Route path="profile" element={<ProfileDashboardView />} />
          <Route path="inbox" element={<SimulatedInboxView />} />
        </Route>
      </Routes>
      <ChatbotPanel />
    </>
  );
};

export default App;
