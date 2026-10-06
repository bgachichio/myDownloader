// Theme (Auto / Light / Dark) and font size (four steps), persisted to localStorage and applied to <html>.
// One provider at the app root, so every control reads and writes the same state.
// The head script in index.html applies both before first paint, so nothing flashes.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppContext, THEMES, SCALES } from './app-context.js';

const read = (key, allowed, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return allowed.some((a) => a.id === v) ? v : fallback;
  } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* private mode: keep it in memory */ }
};
const applyTheme = (theme) => {
  const dark = theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
};

export function AppProvider({ children }) {
  const [theme, setThemeState] = useState(() => read('ui.theme', THEMES, 'system'));
  const [fontScale, setScaleState] = useState(() => read('ui.fontScale', SCALES, 'default'));
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system'); // follow the device live while on Auto
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  useEffect(() => { document.documentElement.dataset.fontScale = fontScale; }, [fontScale]);

  const setTheme = useCallback((id) => { write('ui.theme', id); setThemeState(id); }, []);
  const setFontScale = useCallback((id) => { write('ui.fontScale', id); setScaleState(id); }, []);

  const value = useMemo(
    () => ({ theme, setTheme, fontScale, setFontScale, supportOpen, setSupportOpen }),
    [theme, setTheme, fontScale, setFontScale, supportOpen],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
