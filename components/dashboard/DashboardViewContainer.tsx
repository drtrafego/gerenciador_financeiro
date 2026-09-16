"use client";

import React from "react";
import { useProfile } from "@/lib/contexts/ProfileContext";
import PersonalDashboardView from "@/components/dashboard/PersonalDashboardView";

export default function DashboardViewContainer({ children }: { children: React.ReactNode }) {
  const { mode, isLoaded } = useProfile();

  const isPF = mode === "pf" || (typeof window !== "undefined" && (localStorage.getItem("app_profile_mode") === "pf" || document.cookie.includes("app_profile_mode=pf")));

  if (isPF) {
    return <PersonalDashboardView />;
  }

  if (!isLoaded) {
    return (
      <div className="space-y-6 animate-pulse p-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
        <div className="h-10 bg-zinc-800/60 rounded-xl w-1/3"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-28 bg-zinc-800/40 rounded-2xl"></div>
          <div className="h-28 bg-zinc-800/40 rounded-2xl"></div>
          <div className="h-28 bg-zinc-800/40 rounded-2xl"></div>
        </div>
        <div className="h-64 bg-zinc-800/40 rounded-2xl"></div>
      </div>
    );
  }

  return <>{children}</>;
}
