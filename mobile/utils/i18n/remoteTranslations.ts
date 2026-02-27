import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LanguageKey } from "./languages";
import { API_BASE } from "../../url";

const REMOTE_I18N_VERSION_KEY = "REMOTE_I18N_VERSION_V1";
const REMOTE_I18N_CACHE_KEY = "REMOTE_I18N_CACHE_V1";

const BASE_URL = `${API_BASE.replace(/\/api\/?$/, "")}/i18n`;

type TranslationJson = Record<string, any>;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.json();
}

function isValidTranslationObject(data: any) {
  return data && typeof data === "object" && !Array.isArray(data);
}

export async function getCachedRemoteTranslations(): Promise<
  Partial<Record<LanguageKey, TranslationJson>>
> {
  try {
    const raw = await AsyncStorage.getItem(REMOTE_I18N_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed ?? {};
  } catch {
    return {};
  }
}

export async function syncRemoteTranslations(): Promise<boolean> {
  try {
    // Small version check file
    const remoteVersion = await fetchJson<{ version: number }>(
      `${BASE_URL}/version.json`,
    );

    const localVersionStr = await AsyncStorage.getItem(REMOTE_I18N_VERSION_KEY);
    const localVersion = localVersionStr ? Number(localVersionStr) : 0;

    if (remoteVersion.version <= localVersion) {
      return false; // no update needed
    }

    // Download all language JSON
    const [en, th, my] = await Promise.all([
      fetchJson<TranslationJson>(`${BASE_URL}/english.json`),
      fetchJson<TranslationJson>(`${BASE_URL}/thai.json`),
      fetchJson<TranslationJson>(`${BASE_URL}/burmese.json`),
    ]);

    // Validate
    if (!isValidTranslationObject(en)) throw new Error("Invalid english.json");
    if (!isValidTranslationObject(th)) throw new Error("Invalid thai.json");
    if (!isValidTranslationObject(my)) throw new Error("Invalid burmese.json");

    // Save cache
    const payload = { en, th, my };
    await AsyncStorage.setItem(REMOTE_I18N_CACHE_KEY, JSON.stringify(payload));
    await AsyncStorage.setItem(
      REMOTE_I18N_VERSION_KEY,
      String(remoteVersion.version),
    );

    return true;
  } catch (e: any) {
    console.log("Remote i18n sync failed:", e?.message);
    return false;
  }
}
