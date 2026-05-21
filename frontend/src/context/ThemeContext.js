import React, { createContext, useContext, useEffect, useState } from 'react';

export const THEMES = [
  { id: 'dark',     label: 'Charcoal',  swatches: ['#1c1c1e', '#f97316', '#f59e0b'] },
  { id: 'light',    label: 'Amber',     swatches: ['#fffbf5', '#d97706', '#fef3c7'] },
  { id: 'ocean',    label: 'Ocean',     swatches: ['#0a1628', '#06b6d4', '#0ea5e9'] },
  { id: 'forest',   label: 'Forest',    swatches: ['#0d1f0f', '#22c55e', '#16a34a'] },
  { id: 'midnight', label: 'Midnight',  swatches: ['#12091f', '#8b5cf6', '#7c3aed'] },
  { id: 'rose',     label: 'Rose',      swatches: ['#fff0f3', '#e11d48', '#ffd6dc'] },
];

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('fmp68_theme') || 'dark';
    setThemeState(savedTheme);
    applyTheme(savedTheme);
    setMounted(true);
  }, []);

  const applyTheme = (themeName) => {
    if (themeName === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', themeName);
    }
  };

  const setTheme = (themeName) => {
    setThemeState(themeName);
    localStorage.setItem('fmp68_theme', themeName);
    applyTheme(themeName);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const value = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
  };

  if (!mounted) return children;

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
