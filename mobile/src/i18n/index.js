import i18n from "i18next";
import * as Localization from "expo-localization";
import { initReactI18next } from "react-i18next";
import english from "./locales/english.json";
import hindi from "./locales/hindi.json";

const resources = {
  en: {
    translation: english
  },
  hi: {
    translation: hindi
  }
};

const deviceLanguage = Localization.getLocales()[0]?.languageCode || "en";

i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  resources,
  lng: deviceLanguage === "hi" ? "hi" : "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
