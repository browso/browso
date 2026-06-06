import { useState, useEffect } from "react";

export const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check if dark mode preference exists in localStorage
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode !== null) {
      return JSON.parse(savedMode);
    }
    // Otherwise check system preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    // Apply or remove dark class on document root
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Save preference to localStorage
    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));

    // Broadcast dark mode change to main process
    if (window.browso) {
      window.browso.ipcRenderer.send("dark-mode-changed", isDarkMode);
    }
  }, [isDarkMode]);

  // Listen for dark mode changes from other windows
  useEffect(() => {
    const handleDarkModeUpdate = (_event: any, newDarkMode: boolean) => {
      setIsDarkMode(newDarkMode);
    };

    if (window.browso) {
      window.browso.ipcRenderer.on("dark-mode-updated", handleDarkModeUpdate);
    }

    return () => {
      if (window.browso) {
        window.browso.ipcRenderer.removeListener(
          "dark-mode-updated",
          handleDarkModeUpdate,
        );
      }
    };
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return { isDarkMode, setDarkMode: setIsDarkMode, toggleDarkMode };
};
