import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "nativewind";
import i18n from "../i18n";

const PreferencesContext = createContext(null);

export function PreferencesProvider({ children }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [language, setLanguage] = useState(i18n.language?.startsWith("hi") ? "hi" : "en");

  useEffect(() => {
    (async () => {
      const [savedTheme, savedLanguage] = await Promise.all([
        AsyncStorage.getItem("sahayak_theme"),
        AsyncStorage.getItem("sahayak_language")
      ]);

      if (savedTheme === "light" || savedTheme === "dark") {
        setColorScheme(savedTheme);
      }

      if (savedLanguage === "en" || savedLanguage === "hi") {
        setLanguage(savedLanguage);
        await i18n.changeLanguage(savedLanguage);
      }
    })();
  }, [setColorScheme]);

  const toggleTheme = async () => {
    const next = colorScheme === "dark" ? "light" : "dark";
    setColorScheme(next);
    await AsyncStorage.setItem("sahayak_theme", next);
  };

  const changeLanguage = async (nextLanguage) => {
    setLanguage(nextLanguage);
    await i18n.changeLanguage(nextLanguage);
    await AsyncStorage.setItem("sahayak_language", nextLanguage);
  };

  const value = useMemo(
    () => ({
      theme: colorScheme || "light",
      language,
      toggleTheme,
      changeLanguage
    }),
    [colorScheme, language]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
