import { forwardRef, useImperativeHandle, useRef } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { usePreferences } from "../contexts/PreferencesContext";
import { darkColors, lightColors } from "../theme/colors";
import { useTheme } from "../utils/context/theme";
import CustomPicker from "./CustomPicker";

const LanguagePicker = forwardRef(({ modalOnly = false }, ref) => {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const { t, i18n } = useTranslation();
  const { language, changeLanguage } = usePreferences();
  const pickerRef = useRef(null);

  // Expose open method to parent component
  useImperativeHandle(ref, () => ({
    openModal: () => {
      if (pickerRef.current) {
        pickerRef.current.click();
      }
    },
  }));

  const languages = [
    { label: "English", value: "en" },
    { label: "हिंदी", value: "hi" },
  ];

  const handleLanguageChange = (item) => {
    changeLanguage(item.value);
  };

  // If modalOnly, render hidden picker that can be triggered externally
  if (modalOnly) {
    return (
      <View style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}>
        <CustomPicker
          ref={pickerRef}
          data={languages}
          value={language || (i18n.language?.startsWith("hi") ? "hi" : "en")}
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
        {t("language")}
      </Text>
      <View className="w-[120px]">
        <CustomPicker
          data={languages}
          value={language || (i18n.language?.startsWith("hi") ? "hi" : "en")}
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
