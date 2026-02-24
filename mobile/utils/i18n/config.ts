import * as Localization from "expo-localization";
import { I18n } from "i18n-js";
import { LANGUAGES, LanguageKey } from "./languages";

const messages = Object.fromEntries(
  Object.entries(LANGUAGES).map(([key, value]) => [key, value.messages])
);

export const i18n = new I18n(messages);

i18n.enableFallback = true;
i18n.defaultLocale = "en";

// 🌍 reliable device language detection
const locales = Localization.getLocales();
const primaryLocale = locales?.[0];

const detectedLanguage =
  primaryLocale?.languageTag?.split("-")[0] ||
  primaryLocale?.languageCode ||
  "en";

const supportedLanguages = Object.keys(LANGUAGES);

const finalLocale: LanguageKey = supportedLanguages.includes(detectedLanguage)
  ? (detectedLanguage as LanguageKey)
  : "en";

i18n.locale = finalLocale;
