import { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'puchi';

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'light',
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('hotel_theme');
    return saved === 'dark' || saved === 'puchi' ? saved : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark' || theme === 'puchi');
    document.documentElement.classList.toggle('puchi-theme', theme === 'puchi');
    localStorage.setItem('hotel_theme', theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === 'light' ? 'dark' : t === 'dark' ? 'puchi' : 'light');

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeCtx);
}
