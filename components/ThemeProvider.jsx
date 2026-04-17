"use client";

import { useEffect } from "react";

export function ThemeProvider({ children }) {
  useEffect(() => {
    const stored = localStorage.getItem("dineboss-theme");
    const theme = stored || "dark";
    const html = document.documentElement;
    
    if (theme === "light") {
      html.classList.add("light");
    } else {
      html.classList.remove("light");
    }
  }, []);

  return <>{children}</>;
}
