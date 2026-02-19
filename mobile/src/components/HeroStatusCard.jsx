import { ImageBackground, Text, TouchableOpacity, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { usePreferences } from "../contexts/PreferencesContext";
import { darkColors, lightColors } from "../theme/colors";

export default function HeroStatusCard({
  title,
  subtitle,
  statusLabel,
  actionLabel,
  onPress,
  imageSource = require("../../assets/hero.jpg"),
}) {
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <View style={{ borderRadius: 14, overflow: "hidden", marginTop: 12 }}>
        <ImageBackground source={imageSource} resizeMode="cover" style={{ minHeight: 200 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.40)", padding: 18, justifyContent: "space-between" }}>
            <View>
              <Text style={{ color: colors.light, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }}>{statusLabel}</Text>
              <Text style={{ color: colors.light, fontSize: 28, fontWeight: "800", marginTop: 4 }}>{title}</Text>
              <Text style={{ color: "#F3F4F6", fontSize: 13, marginTop: 4 }}>{subtitle}</Text>
            </View>

            <View style={{ backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: colors.dark, fontSize: 13, fontWeight: "700" }}>{actionLabel}</Text>
              <ChevronRight size={18} color={colors.dark} />
            </View>
          </View>
        </ImageBackground>
      </View>
    </TouchableOpacity>
  );
}
