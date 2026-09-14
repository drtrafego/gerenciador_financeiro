"use client";

import React from "react";
import { useProfile } from "@/lib/contexts/ProfileContext";
import PersonalSettingsView from "@/components/settings/PersonalSettingsView";

export default function SettingsViewContainer({ children }: { children: React.ReactNode }) {
  const { mode } = useProfile();

  if (mode === "pf") {
    return <PersonalSettingsView />;
  }

  return <>{children}</>;
}
