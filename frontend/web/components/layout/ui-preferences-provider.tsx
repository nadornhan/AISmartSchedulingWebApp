'use client';

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type ColorTheme = 'dark' | 'light';

type UiPreferencesContextValue = {
  theme: ColorTheme;
  setTheme: (theme: ColorTheme) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
};

const THEME_STORAGE_KEY = 'chrono-color-theme';
const SIDEBAR_STORAGE_KEY = 'chrono-sidebar-collapsed';

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

export function UiPreferencesProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [theme, setTheme] = useState<ColorTheme>('dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme: ColorTheme = savedTheme === 'light' ? 'light' : 'dark';
    const nextSidebarCollapsed = window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';

    setTheme(nextTheme);
    setSidebarCollapsed(nextSidebarCollapsed);
    document.documentElement.dataset.theme = nextTheme;
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;

    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [preferencesLoaded, theme]);

  useEffect(() => {
    if (!preferencesLoaded) return;

    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
  }, [preferencesLoaded, sidebarCollapsed]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      sidebarCollapsed,
      toggleSidebar: () => setSidebarCollapsed((current) => !current),
    }),
    [sidebarCollapsed, theme],
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences() {
  const context = useContext(UiPreferencesContext);

  if (!context) {
    throw new Error('useUiPreferences must be used within UiPreferencesProvider.');
  }

  return context;
}
