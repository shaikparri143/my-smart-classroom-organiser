import { useContext, useEffect, useState } from "react";
import { ToastContext } from "./designSystemContext";

export function useThemePreference() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    const saved = window.localStorage.getItem("classpilot-theme");
    return saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("classpilot-theme", theme);
    window.dispatchEvent(new CustomEvent("classpilot:theme-change", { detail: theme }));
  }, [theme]);
  useEffect(() => {
    const syncTheme = (event) => {
      const nextTheme = event.type === "storage" ? event.newValue : event.detail;
      if (nextTheme === "light" || nextTheme === "dark") setTheme(nextTheme);
    };
    window.addEventListener("classpilot:theme-change", syncTheme);
    window.addEventListener("storage", syncTheme);
    return () => {
      window.removeEventListener("classpilot:theme-change", syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  return [theme, setTheme];
}

export function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = window.localStorage.getItem("classpilot-reduce-motion");
    return saved === null
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : saved === "true";
  });
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduced);
    window.localStorage.setItem("classpilot-reduce-motion", String(reduced));
  }, [reduced]);
  return [reduced, setReduced];
}

export function useToast() {
  return useContext(ToastContext);
}
