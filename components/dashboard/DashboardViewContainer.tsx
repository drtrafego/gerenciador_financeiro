"use client";

import React from "react";
import { useProfile } from "@/lib/contexts/ProfileContext";
import PersonalDashboardView from "@/components/dashboard/PersonalDashboardView";

export default function DashboardViewContainer({ children }: { children: React.ReactNode }) {
  const { mode } = useProfile();

  if (mode === "pf") {
    return <PersonalDashboardView />;
  }

  return <>{children}</>;
}
