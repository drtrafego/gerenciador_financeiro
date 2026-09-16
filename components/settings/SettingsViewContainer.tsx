"use client";

import React from "react";
import { useProfile } from "@/lib/contexts/ProfileContext";
import PersonalSettingsView from "@/components/settings/PersonalSettingsView";

export default function SettingsViewContainer({ children }: { children: React.ReactNode }) {
  const { mode } = useProfile();

  const isPF = mode === "pf" || (typeof window !== "undefined" && (localStorage.getItem("app_profile_mode") === "pf" || document.cookie.includes("app_profile_mode=pf")));

  if (isPF) {
    return <PersonalSettingsView />;
  }

  return <>{children}</>;
}
