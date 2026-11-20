import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { BottomNav } from "./BottomNav";
import { LoginRegisterModal } from "../auth/LoginRegisterModal";

export const Layout: React.FC = () => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#2D231E]">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-5 pb-24 md:pb-10">
        <Outlet />
      </main>
      <Footer />
      <BottomNav onOpenAuthModal={() => setIsAuthModalOpen(true)} />
      <LoginRegisterModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
};
