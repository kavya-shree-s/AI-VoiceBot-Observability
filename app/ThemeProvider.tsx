"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type ThemeChoice = "system" | "light" | "dark";

const KEY = "breeze-theme";

type ThemeContextValue = {
  choice: ThemeChoice;
  setChoice: (next: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("system");

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const stored = localStorage.getItem(KEY) as ThemeChoice | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setChoiceState(stored);
      apply(stored);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    localStorage.setItem(KEY, next);
    apply(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ choice, setChoice }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/**
 * Inline script content that runs before React hydration to prevent a theme
 * flash. Mount via `<script dangerouslySetInnerHTML={{ __html: THEME_INIT }}/>`
 * inside `<head>`.
 */
export const THEME_INIT = `
(function(){
  try {
    var v = localStorage.getItem('${KEY}');
    if (v === 'light' || v === 'dark') {
      document.documentElement.setAttribute('data-theme', v);
    }
  } catch (_) {}
})();
`;
