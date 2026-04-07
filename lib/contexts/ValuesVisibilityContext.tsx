"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "hide_values";

type ContextType = { hidden: boolean; toggle: () => void };

const ValuesVisibilityContext = createContext<ContextType>({
  hidden: false,
  toggle: () => {},
});

export function ValuesVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const toggle = () => {
    setHidden((v) => {
      const next = !v;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <ValuesVisibilityContext.Provider value={{ hidden, toggle }}>
      {children}
    </ValuesVisibilityContext.Provider>
  );
}

export function useValuesVisibility() {
  return useContext(ValuesVisibilityContext);
}
