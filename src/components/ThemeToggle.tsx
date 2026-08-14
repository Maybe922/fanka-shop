"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@heroui/react";

type Theme = "light" | "dark";

function subscribeTheme(onStoreChange: () => void): () => void {
  window.addEventListener("themechange", onStoreChange);
  return () => window.removeEventListener("themechange", onStoreChange);
}

function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 深/浅色切换。主题状态存在 <html> 的 class + data-theme 上，
 * 选择持久化到 localStorage（首屏由 layout 里的内联脚本无闪烁恢复）。
 */
export function ThemeToggle() {
  // <html> 是主题状态的真源；useSyncExternalStore 同时提供稳定的 SSR 快照，
  // 避免在 Effect 中同步 setState 造成额外渲染和 lint 错误。
  const theme = useSyncExternalStore<Theme | null>(
    subscribeTheme,
    currentTheme,
    () => null,
  );

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const el = document.documentElement;
    el.classList.remove("light", "dark");
    el.classList.add(next);
    el.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // 隐私模式等场景写不进去——切换仍生效，只是不记忆
    }
    window.dispatchEvent(new Event("themechange"));
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      isIconOnly
      aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
      onPress={toggle}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
