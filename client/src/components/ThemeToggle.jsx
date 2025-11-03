import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react"; // ✅ modern icons

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = isDark ? "light" : "dark";
    document.documentElement.classList.toggle("dark", !isDark);
    localStorage.setItem("theme", newTheme);
    setIsDark(!isDark);
  };

  return (
    <div className="absolute right-5 top-3">
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full bg-main/90 text-highlight dark:bg-white dark:text-main 
                 hover:scale-110 transition-all duration-300 shadow-md hover:shadow-lg"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="w-5 h-5 transition-transform duration-300 rotate-90" />
      ) : (
        <Moon className="w-5 h-5 transition-transform duration-300 -rotate-12" />
      )}
    </button>
    </div>
  );
}
