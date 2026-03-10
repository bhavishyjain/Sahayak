import getUserAuth from "@/utils/userAuth";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { darkColors, lightColors } from "../colors";
import { useTheme } from "../utils/context/theme";

export default function Index() {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  useEffect(() => {
    (async () => {
      const user = await getUserAuth();
      if (user?.auth_token) {
        // Redirect based on user role
        const redirectPath =
          user.role === "head"
            ? "/(app)/(tabs)/hod-overview"
            : user.role === "worker"
              ? "/(app)/(tabs)/worker-home"
              : "/(app)/(tabs)/home";
        router.replace(redirectPath);
      } else {
        router.replace("/(app)/(auth)/login");
      }
    })();
  }, [router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.backgroundPrimary,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
