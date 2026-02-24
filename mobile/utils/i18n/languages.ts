import en from "../../assets/lang/english.json";
import th from "../../assets/lang/thai.json";

export const LANGUAGES = {
  en: {
    label: "English",
    messages: en,
    value: "en",
  },
  th: {
    label: "ไทย",
    messages: th,
    value: "th",
  },
  // my: {
  //   label: "မြန်မာ",
  //   messages: my,
  //   value: "my",
  // },
} as const;

export type LanguageKey = keyof typeof LANGUAGES;
