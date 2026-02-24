import { useEffect } from "react";
import { ActivityIndicator, Image, SafeAreaView, View } from "react-native";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { darkColors, lightColors } from "../../../theme/colors";

export default function WelcomeScreen({ navigation }) {
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace("Login");
    }, 900);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <SafeAreaView
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.backgroundPrimary,
      }}
    >
      <Image
        source={require("../../../assets/images/splash.png")}
        style={{ width: 150, height: 150, resizeMode: "contain" }}
      />
      <View style={{ marginTop: 20 }}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    </SafeAreaView>
  );
}
