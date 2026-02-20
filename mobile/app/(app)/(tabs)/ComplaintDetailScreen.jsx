import { useNavigation } from "@react-navigation/native";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Card from "../../../components/Card";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { darkColors, lightColors } from "../../../theme/colors";
import { statusColor } from "../../../utils/status";

export default function ComplaintDetailScreen({ route }) {
  const navigation = useNavigation();
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;
  const item = route?.params?.item;

  if (!item) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.backgroundPrimary,
          paddingHorizontal: 16,
        }}
      >
        <View className="mt-2 flex-row items-center">
          <Text
            onPress={() => navigation.goBack()}
            style={{ color: colors.primary, fontWeight: "700" }}
          >
            Back
          </Text>
        </View>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 18,
            fontWeight: "700",
            marginTop: 12,
          }}
        >
          Complaint
        </Text>
        <Text style={{ color: colors.textPrimary, marginTop: 16 }}>
          Complaint not found.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.backgroundPrimary,
        paddingHorizontal: 16,
      }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="mt-2 flex-row items-center">
          <Text
            onPress={() => navigation.goBack()}
            style={{ color: colors.primary, fontWeight: "700" }}
          >
            Back
          </Text>
        </View>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 18,
            fontWeight: "700",
            marginTop: 12,
          }}
        >
          Complaint details
        </Text>
        <Text
          className="mt-2 text-3xl font-extrabold"
          style={{ color: colors.textPrimary }}
        >
          {item.title}
        </Text>
        <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
          Ticket: {item.ticketId || "-"}
        </Text>

        <Card className="mt-4">
          <View className="flex-row items-center justify-between">
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.textPrimary }}
            >
              Status
            </Text>
            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: `${statusColor(item.status)}20` }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: statusColor(item.status) }}
              >
                {item.status}
              </Text>
            </View>
          </View>
        </Card>

        <Card className="mt-3">
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.textPrimary }}
          >
            Description
          </Text>
          <Text
            className="mt-2 text-sm"
            style={{ color: colors.textSecondary }}
          >
            {item.description || "-"}
          </Text>
        </Card>

        <Card className="mt-3">
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.textPrimary }}
          >
            Department
          </Text>
          <Text
            className="mt-1 text-sm"
            style={{ color: colors.textSecondary }}
          >
            {item.department || "-"}
          </Text>
          <Text
            className="mt-3 text-sm font-semibold"
            style={{ color: colors.textPrimary }}
          >
            Priority
          </Text>
          <Text
            className="mt-1 text-sm"
            style={{ color: colors.textSecondary }}
          >
            {item.priority || "-"}
          </Text>
          <Text
            className="mt-3 text-sm font-semibold"
            style={{ color: colors.textPrimary }}
          >
            Location
          </Text>
          <Text
            className="mt-1 text-sm"
            style={{ color: colors.textSecondary }}
          >
            {item.locationName || "-"}
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
