import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';

type Theme = 'default' | 'light' | 'dark' | 'corporate' | 'ocean' | 'nature' | 'midnight';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextType | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedPrefs = window.localStorage.getItem('theme');
    if (['default', 'light', 'dark', 'corporate', 'ocean', 'nature', 'midnight'].includes(storedPrefs || '')) {
      return storedPrefs as Theme;
    }
  }
  // Always fallback to 'default' if no preference is stored, ignoring system preferences.
  return 'default';
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};