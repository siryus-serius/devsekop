"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("diploma_vault_theme") as "dark" | "light" | null;
    if (saved) {
      setTheme(saved);
      applyTheme(saved);
    } else {
      // Default to dark or match system
      const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
      const initial = prefersLight ? "light" : "dark";
      setTheme(initial);
      applyTheme(initial);
    }
  }, []);

  function applyTheme(newTheme: "dark" | "light") {
    const root = document.documentElement;
    if (newTheme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
    }
  }

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("diploma_vault_theme", nextTheme);
    applyTheme(nextTheme);
  }

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-xl bg-slate-800/40 border border-slate-700/50 animate-pulse" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 border cursor-pointer
        light:bg-[#e8e2d5] light:border-[#d4cbba] light:text-[#44403c] light:hover:bg-[#dfd8ca] light:hover:text-[#1c1917] light:shadow-sm
        dark:bg-slate-800/80 dark:border-slate-700/80 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
      title={theme === "dark" ? "Ganti ke Tema Beige (Eye-Friendly)" : "Ganti ke Tema Dark"}
      aria-label="Toggle Theme"
    >
      {theme === "dark" ? (
        <>
          <Sun className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">Beige Mode</span>
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-indigo-600" />
          <span className="hidden sm:inline">Dark Mode</span>
        </>
      )}
    </button>
  );
}
