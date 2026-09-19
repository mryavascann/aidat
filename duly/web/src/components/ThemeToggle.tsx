import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import type { Messages } from "../i18n/en";

type Theme = "light" | "dark";
const preferenceKey = "duly:theme";

function savedTheme(): Theme | null {
  try {
    const value = JSON.parse(localStorage.getItem(preferenceKey) ?? "null");
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#101a16" : "#f7f7f2");
}

export function ThemeToggle({ t }: { t: Messages }) {
  // The HTML bootstrap sets the theme before React and the stylesheet load.
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  const [manual, setManual] = useState(() => savedTheme() !== null);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  useEffect(() => {
    if (manual) return;
    const system = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(system.matches ? "dark" : "light");
    update();
    system.addEventListener("change", update);
    return () => system.removeEventListener("change", update);
  }, [manual]);
  return (
    <button
      className="icon-button theme-toggle"
      type="button"
      role="switch"
      aria-checked={theme === "dark"}
      aria-label={t.darkMode}
      title={theme === "dark" ? t.lightMode : t.darkMode}
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        setManual(true);
        setTheme(next);
        try {
          localStorage.setItem(preferenceKey, JSON.stringify(next));
        } catch {
          /* A blocked preference store must not block the interface. */
        }
      }}
    >
      {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}
