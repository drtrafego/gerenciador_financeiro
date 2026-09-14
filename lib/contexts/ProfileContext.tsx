"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ProfileMode = "pj" | "pf";

interface ProfileContextType {
  mode: ProfileMode;
  setMode: (mode: ProfileMode) => void;
  lang: "pt" | "es";
  setLang: (lang: "pt" | "es") => void;
  isLoaded: boolean;
}

const ProfileContext = createContext<ProfileContextType>({
  mode: "pj",
  setMode: () => {},
  lang: "pt",
  setLang: () => {},
  isLoaded: false,
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ProfileMode>(() => {
    if (typeof window !== "undefined") {
      const savedMode = localStorage.getItem("app_profile_mode") as ProfileMode;
      if (savedMode === "pj" || savedMode === "pf") {
        return savedMode;
      }
    }
    return "pj";
  });

  const [lang, setLangState] = useState<"pt" | "es">(() => {
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem("app_profile_lang") as "pt" | "es";
      if (savedLang === "pt" || savedLang === "es") {
        return savedLang;
      }
    }
    return "pt";
  });

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem("app_profile_mode") as ProfileMode;
    if (savedMode === "pj" || savedMode === "pf") {
      setModeState(savedMode);
    }
    const savedLang = localStorage.getItem("app_profile_lang") as "pt" | "es";
    if (savedLang === "pt" || savedLang === "es") {
      setLangState(savedLang);
    }
    setIsLoaded(true);
  }, []);

  const setMode = (newMode: ProfileMode) => {
    setModeState(newMode);
    localStorage.setItem("app_profile_mode", newMode);
    window.dispatchEvent(new Event("user_pf_data_changed"));
  };

  const setLang = (newLang: "pt" | "es") => {
    setLangState(newLang);
    localStorage.setItem("app_profile_lang", newLang);
  };

  return (
    <ProfileContext.Provider value={{ mode, setMode, lang, setLang, isLoaded }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
