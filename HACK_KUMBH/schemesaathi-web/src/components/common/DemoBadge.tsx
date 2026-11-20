import React from "react";
import { Sparkles } from "lucide-react";

interface DemoBadgeProps {
  label?: string;
  variant?: "primary" | "warning" | "neutral";
  className?: string;
}

export const DemoBadge: React.FC<DemoBadgeProps> = ({
  label = "DEMO SIMULATION",
  variant = "warning",
  className = "",
}) => {
  const variantStyles = {
    warning: "bg-amber-100 text-amber-900 border-amber-300",
    primary: "bg-blue-100 text-blue-900 border-blue-300",
    neutral: "bg-slate-200 text-slate-800 border-slate-300",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black tracking-wider uppercase border shadow-xs ${variantStyles[variant]} ${className}`}
    >
      <Sparkles className="w-3 h-3 text-amber-600" />
      <span>{label}</span>
    </span>
  );
};
