// src/components/ThemeProvider.jsx
import { useEffect } from "react";

export default function ThemeProvider() {
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  return null; // This just runs once globally
}
