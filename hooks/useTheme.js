"use client";

import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("dineboss-theme");
    const initial = stored || "dark";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const applyTheme = (mode) => {
    const html = document.documentElement;
    if (mode === "light") {
      html.classList.add("light");
    } else {
      html.classList.remove("light");
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("dineboss-theme", newTheme);
    applyTheme(newTheme);
  };

  return { theme, toggleTheme, mounted };
}
