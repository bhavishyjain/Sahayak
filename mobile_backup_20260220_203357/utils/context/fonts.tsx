import { useFonts } from "expo-font";

export function useAppFonts() {
  const [loaded] = useFonts({
    // Inter
    "Inter-Light": require("@/assets/fonts/Inter_18pt-Light.ttf"),
    "Inter-Regular": require("@/assets/fonts/Inter_18pt-Regular.ttf"),
    "Inter-Medium": require("@/assets/fonts/Inter_18pt-Medium.ttf"),
    "Inter-SemiBold": require("@/assets/fonts/Inter_18pt-SemiBold.ttf"),
    "Inter-Bold": require("@/assets/fonts/Inter_18pt-Bold.ttf"),

    // Fira Sans
    "Fira-Regular": require("@/assets/fonts/FiraSans-Regular.ttf"),
    "Fira-Medium": require("@/assets/fonts/FiraSans-Medium.ttf"),
    "Fira-Bold": require("@/assets/fonts/FiraSans-Bold.ttf"),
  });

  return loaded;
}
