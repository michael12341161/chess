import { createContext, createElement, use, useEffect, useMemo, useState } from 'react';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../utils/constants.js';
import { audioManager } from '../services/audio/AudioManager.js';

const SettingsContext = createContext(null);

function readSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) ?? '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(readSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    audioManager.setEnabled(settings.soundEnabled);
    document.documentElement.dataset.theme = settings.boardTheme;
  }, [settings]);

  const value = useMemo(
    () => ({
      settings,
      updateSettings: (patch) => setSettings((current) => ({ ...current, ...patch })),
      resetSettings: () => setSettings(DEFAULT_SETTINGS),
    }),
    [settings],
  );

  return createElement(SettingsContext.Provider, { value }, children);
}

export function useSettingsStore() {
  const context = use(SettingsContext);
  if (!context) throw new Error('useSettingsStore must be used inside SettingsProvider.');
  return context;
}
