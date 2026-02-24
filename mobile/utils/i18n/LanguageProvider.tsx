import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";
import { i18n } from "./config";
import { LanguageKey, LANGUAGES } from "./languages";

const STORAGE_KEY = "app_language";

type LanguageContextType = {
  locale: LanguageKey;
  setLanguage: (lang: LanguageKey) => void;
  t: (key: string, options?: any) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  locale: "en",
  setLanguage: () => {},
  t: (key: string) => key,
});

/* ---------- storage helpers ---------- */

const getStoredLanguage = async (): Promise<LanguageKey | null> => {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(STORAGE_KEY) as LanguageKey;
    }
    return (await AsyncStorage.getItem(STORAGE_KEY)) as LanguageKey;
  } catch {
    return null;
  }
};

const saveStoredLanguage = async (lang: LanguageKey) => {
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(STORAGE_KEY, lang);
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    }
  } catch {}
};

/* ---------- provider ---------- */

export const LanguageProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [locale, setLocale] = useState<LanguageKey>(i18n.locale as LanguageKey);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const init = async () => {
      const stored = await getStoredLanguage();

      const finalLang =
        stored && LANGUAGES[stored] ? stored : (i18n.locale as LanguageKey);

      i18n.locale = finalLang;
      setLocale(finalLang);
      setHydrated(true);
    };

    init();
  }, []);

  const setLanguage = useCallback(async (lang: LanguageKey) => {
    i18n.locale = lang;
    setLocale(lang);
    await saveStoredLanguage(lang);
  }, []);

  const t = useCallback(
    (key: string, options?: any) => i18n.t(key, { ...options, locale }),
    [locale] // Re-create when locale changes
  );

  const value = useMemo(
    () => ({ locale, setLanguage, t }),
    [locale, setLanguage, t]
  );

  if (!hydrated) return null;

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

/* ---------- hooks ---------- */

export const useLanguage = () => useContext(LanguageContext);

export const useTranslation = () => {
  const { t, locale } = useLanguage();
  return { t, locale };
};
