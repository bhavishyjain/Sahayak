import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const SETTINGS_KEY = "SYSTEM_SETTINGS_V2"; // bump key because new structure
const DEFAULT_SETTINGS: Record<string, any> = {};

type RawSettingItem = { key: string; value: any };

type SettingsContextType = {
  settings: Record<string, any> | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      const normalized = settings ?? DEFAULT_SETTINGS;
      setSettings(normalized);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    } catch (err: any) {
      console.log("settings refresh failed:", err?.message || err);
    }
  }, [settings]);

  useEffect(() => {
    (async () => {
      try {
        // 1) load cached first
        const cached = await AsyncStorage.getItem(SETTINGS_KEY);
        if (cached) {
          setSettings(JSON.parse(cached));
        } else {
          setSettings(DEFAULT_SETTINGS);
        }

        // 2) persist normalized local defaults/cached settings
        await refreshSettings();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo(
    () => ({ settings, loading, refreshSettings }),
    [settings, loading],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

function tryParseJson(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function smartParseValue(value: any) {
  if (value === null || value === undefined) return value;

  // already not string
  if (typeof value !== "string") return value;

  const trimmed = value.trim();

  // boolean strings
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  // number strings (int/float)
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

  // JSON objects/arrays
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return tryParseJson(trimmed);
  }

  // default keep string
  return value;
}

export function normalizeSettings(raw: RawSettingItem[]) {
  const out: Record<string, any> = {};

  raw?.forEach((item) => {
    if (!item?.key) return;
    out[item.key] = smartParseValue(item.value);
  });

  return out;
}
