import { usePreferences } from "../../contexts/PreferencesContext";

export function useTheme() {
  const { theme, toggleTheme } = usePreferences();
  return {
    colorScheme: theme,
    toggleTheme,
  };
}
