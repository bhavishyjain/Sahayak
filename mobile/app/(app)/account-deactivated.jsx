import { useRouter } from "expo-router";
import { Ban, LogOut } from "lucide-react-native";
import { ActivityIndicator, Text, View } from "react-native";
import { darkColors, lightColors } from "../../colors";
import PressableBlock from "../../components/PressableBlock";
import { useTheme } from "../../utils/context/theme";
import { clearUserAuth } from "../../utils/userAuth";
import { useState } from "react";

export default function AccountDeactivatedScreen() {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await clearUserAuth();
      router.replace("/(app)/(auth)/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <View
      className="flex-1 px-6 items-center justify-center"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <View
        className="w-20 h-20 rounded-full items-center justify-center mb-6"
        style={{ backgroundColor: colors.danger + "18" }}
      >
        <Ban size={36} color={colors.danger} />
      </View>

      <Text
        className="text-2xl font-bold text-center"
        style={{ color: colors.textPrimary }}
      >
        Account Deactivated
      </Text>

      <Text
        className="text-sm text-center mt-3 leading-6"
        style={{ color: colors.textSecondary }}
      >
        This account has been deactivated by an administrator. You cannot use
        the app until the account is reactivated.
      </Text>

      <Text
        className="text-sm text-center mt-2 leading-6"
        style={{ color: colors.textSecondary }}
      >
        Please contact your administrator or department owner for access.
      </Text>

      <PressableBlock
        onPress={handleLogout}
        disabled={loggingOut}
        className="mt-8 rounded-xl px-5 py-3 flex-row items-center"
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: loggingOut ? 0.7 : 1,
        }}
      >
        {loggingOut ? (
          <ActivityIndicator size="small" color={colors.textPrimary} />
        ) : (
          <>
            <LogOut size={16} color={colors.textPrimary} />
            <Text
              className="text-sm font-semibold ml-2"
              style={{ color: colors.textPrimary }}
            >
              Logout
            </Text>
          </>
        )}
      </PressableBlock>
    </View>
  );
}
