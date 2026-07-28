import { useEffect, useState } from "react";

type Theme = "paper" | "midnight";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme =
    theme === "midnight" ? "dark" : "light";
  localStorage.setItem("mazha-theme", theme);
  window.dispatchEvent(new CustomEvent("mazha:theme", { detail: theme }));
}

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("paper");

  useEffect(() => {
    setTheme(
      document.documentElement.dataset.theme === "midnight"
        ? "midnight"
        : "paper",
    );
  }, []);

  const nextTheme = theme === "paper" ? "midnight" : "paper";

  return (
    <button
      className="tool-button theme-switch"
      type="button"
      onClick={() => {
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }}
      aria-label={`切换到${nextTheme === "midnight" ? "午夜书桌" : "纸张"}主题`}
      title="切换纸张 / 午夜书桌主题"
    >
      <span aria-hidden="true">{theme === "paper" ? "☾" : "☀"}</span>
      <span className="tool-button__text">
        {theme === "paper" ? "NIGHT" : "PAPER"}
      </span>
    </button>
  );
}
