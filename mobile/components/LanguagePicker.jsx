import { forwardRef, useImperativeHandle, useRef } from "react";
import { Text, View } from "react-native";
import { darkColors, lightColors } from "../app/(app)/colors";
import { useTheme } from "../utils/context/theme";
import { useLanguage, useTranslation } from "../utils/i18n/LanguageProvider";
import { LANGUAGES } from "../utils/i18n/languages";
import CustomPicker from "./CustomPicker";

const LanguagePicker = forwardRef(({ modalOnly = false }, ref) => {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const { t, locale } = useTranslation();
  const { setLanguage } = useLanguage();
  const pickerRef = useRef(null);

  // Expose open method to parent component
  useImperativeHandle(ref, () => ({
    openModal: () => {
      if (pickerRef.current) {
        pickerRef.current.click();
      }
    },
  }));

  // Map LANGUAGES to picker format
  const languages = Object.values(LANGUAGES).map((lang) => ({
    label: lang.label,
    value: lang.value,
  }));

  const handleLanguageChange = (item) => {
    setLanguage(item.value);
  };

  // If modalOnly, render hidden picker that can be triggered externally
  if (modalOnly) {
    return (
      <View style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}>
        <CustomPicker
          ref={pickerRef}
          data={languages}
          value={locale}
          onChange={handleLanguageChange}
          placeholder="Select Language"
          searchPlaceholder=""
        />
      </View>
    );
  }

  // Default inline mode for login page
  return (
    <View
      className="flex-row items-center justify-center gap-4"
      style={{ zIndex: 9999 }}
    >
      <Text className="text-sm" style={{ color: colors.textPrimary }}>
        {t("auth.login.changeLanguage")}
      </Text>
      <View className="w-[120px]">
        <CustomPicker
          data={languages}
          value={locale}
          onChange={handleLanguageChange}
          placeholder="Select Language"
          searchPlaceholder=""
          containerStyle={{
            height: 35,
            borderBottomWidth: 1,
            borderBottomColor: colors.textSecondary,
            borderWidth: 0,
            borderRadius: 0,
            backgroundColor: "transparent",
          }}
        />
      </View>
    </View>
  );
});

LanguagePicker.displayName = "LanguagePicker";

export default LanguagePicker;
