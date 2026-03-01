import en from "../../assets/lang/english.json";
import hn from "../../assets/lang/hindi.json";

export const LANGUAGES = {
  en: {
    label: "English",
    messages: en,
    value: "en",
  },
  hn: {
    label: "हिन्दी",
    messages: hn,
    value: "hn",
  },
} as const;

export type LanguageKey = keyof typeof LANGUAGES;
