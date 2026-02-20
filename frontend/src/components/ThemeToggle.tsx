'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { HiSun, HiMoon } from 'react-icons/hi';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a placeholder button to avoid hydration mismatch
    return (
      <button
        className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors duration-200"
        disabled
      >
        <HiSun className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <HiSun className="h-5 w-5" /> : <HiMoon className="h-5 w-5" />}
    </button>
  );
}
