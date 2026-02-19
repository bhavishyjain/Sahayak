/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: ["./App.{js,jsx}", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#E6FFFC",
          100: "#BCFFF7",
          200: "#8AFFF0",
          300: "#52F7E5",
          400: "#2EC4B6",
          500: "#209A8F",
          600: "#19756E",
          700: "#135552",
          800: "#0D3A37",
          900: "#081F1E"
        }
      }
    }
  },
  plugins: []
};
