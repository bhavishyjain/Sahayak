const { darkColors, lightColors } = require("./colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    // "./global.css",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Use simple nested structure that works with dark: variant
        background: {
          primary: {
            DEFAULT: lightColors.backgroundPrimary,
            dark: darkColors.backgroundPrimary,
          },
          secondary: {
            DEFAULT: lightColors.backgroundSecondary,
            dark: darkColors.backgroundSecondary,
          },
          darker: {
            DEFAULT: lightColors.backgroundDark,
            dark: darkColors.backgroundDark,
          },
          success: lightColors.backgroundSuccess,
        },
        text: {
          primary: {
            DEFAULT: lightColors.textPrimary,
            dark: darkColors.textPrimary,
          },
          secondary: {
            DEFAULT: lightColors.textSecondary,
            dark: darkColors.textSecondary,
          },
        },
        placeholder: lightColors.placeholder,
        primary: lightColors.primary,
        secondary: lightColors.secondary,
        info: lightColors.info,
        success: lightColors.success,
        warning: lightColors.warning,
        danger: lightColors.danger,
        dark: lightColors.dark,
        light: lightColors.light,
        muted: lightColors.muted,
      },
      fontFamily: {
        sans: ["Inter-Regular"],
        inter: ["Inter-Regular"],
        "inter-medium": ["Inter-Medium"],
        "inter-semibold": ["Inter-SemiBold"],
        "inter-bold": ["Inter-Bold"],
        fira: ["Fira-Regular"],
        "fira-medium": ["Fira-Medium"],
        "fira-bold": ["Fira-Bold"],
      },
    },
  },
  plugins: [],
};
