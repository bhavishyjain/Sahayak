import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance } from "react-native";

type ThemeMode = "light" | "dark" | "system";

type ThemeContextType = {
  colorScheme: "light" | "dark";
  themePreference: ThemeMode;
  setColorScheme: (mode: ThemeMode) => void;
  toggleColorScheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "@app_theme_preference";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [systemScheme, setSystemScheme] = useState<"light" | "dark">(
    Appearance.getColorScheme() === "dark" ? "dark" : "light",
  );

  const [themePreference, setThemePreference] = useState<ThemeMode>("system");
  const [isLoading, setIsLoading] = useState(true);

  // Listen to system theme changes
  useEffect(() => {
    // Force initial check
    const currentScheme = Appearance.getColorScheme();
    const detectedTheme = currentScheme === "dark" ? "dark" : "light";
    setSystemScheme(detectedTheme);

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const newTheme = colorScheme === "dark" ? "dark" : "light";
      setSystemScheme(newTheme);
    });

    return () => subscription.remove();
  }, []);

  // Load theme preference from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (
          savedTheme &&
          (savedTheme === "light" ||
            savedTheme === "dark" ||
            savedTheme === "system")
        ) {
          setThemePreference(savedTheme as ThemeMode);
        }
      } catch (error) {
        console.error("Failed to load theme preference:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // 🔥 DERIVE actual theme
  const colorScheme: "light" | "dark" = useMemo(() => {
    if (themePreference === "system") {
      // Default to "light" if systemScheme is null or undefined
      return systemScheme === "dark" ? "dark" : "light";
    }
    return themePreference;
  }, [themePreference, systemScheme]);

  const setColorScheme = async (mode: ThemeMode) => {
    setThemePreference(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error("Failed to save theme preference:", error);
    }
  };

  const toggleColorScheme = () => {
    setThemePreference((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider
      value={{
        colorScheme,
        themePreference,
        setColorScheme,
        toggleColorScheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
