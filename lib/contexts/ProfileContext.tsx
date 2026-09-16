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
      const match = document.cookie.match(/app_profile_mode=(pj|pf)/);
      if (match && (match[1] === "pj" || match[1] === "pf")) {
        return match[1] as ProfileMode;
      }
      const savedMode = localStorage.getItem("app_profile_mode") as ProfileMode;
      if (savedMode === "pj" || savedMode === "pf") {
        return savedMode;
      }
    }
    return "pj";
  });

  const [lang, setLangState] = useState<"pt" | "es">(() => {
    if (typeof window !== "undefined") {
      const match = document.cookie.match(/app_profile_lang=(pt|es)/);
      if (match && (match[1] === "pt" || match[1] === "es")) {
        return match[1] as "pt" | "es";
      }
      const savedLang = localStorage.getItem("app_profile_lang") as "pt" | "es";
      if (savedLang === "pt" || savedLang === "es") {
        return savedLang;
      }
    }
    return "pt";
  });

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const matchMode = document.cookie.match(/app_profile_mode=(pj|pf)/);
      const cookieMode = matchMode ? matchMode[1] as ProfileMode : null;
      const localMode = localStorage.getItem("app_profile_mode") as ProfileMode;
      const activeMode = cookieMode || localMode;
      if (activeMode === "pj" || activeMode === "pf") {
        setModeState(activeMode);
        document.cookie = `app_profile_mode=${activeMode}; path=/; max-age=31536000; SameSite=Lax`;
        localStorage.setItem("app_profile_mode", activeMode);
      }

      const matchLang = document.cookie.match(/app_profile_lang=(pt|es)/);
      const cookieLang = matchLang ? matchLang[1] as "pt" | "es" : null;
      const localLang = localStorage.getItem("app_profile_lang") as "pt" | "es";
      const activeLang = cookieLang || localLang;
      if (activeLang === "pt" || activeLang === "es") {
        setLangState(activeLang);
        document.cookie = `app_profile_lang=${activeLang}; path=/; max-age=31536000; SameSite=Lax`;
        localStorage.setItem("app_profile_lang", activeLang);
      }
    }
    setIsLoaded(true);
  }, []);

  const setMode = (newMode: ProfileMode) => {
    setModeState(newMode);
    if (typeof window !== "undefined") {
      localStorage.setItem("app_profile_mode", newMode);
      document.cookie = `app_profile_mode=${newMode}; path=/; max-age=31536000; SameSite=Lax`;
    }
    window.dispatchEvent(new Event("user_pf_data_changed"));
  };

  const setLang = (newLang: "pt" | "es") => {
    setLangState(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("app_profile_lang", newLang);
      document.cookie = `app_profile_lang=${newLang}; path=/; max-age=31536000; SameSite=Lax`;
    }
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
