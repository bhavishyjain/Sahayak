import { Tabs } from "expo-router";
import {
  CirclePlus,
  Home,
  ListChecks,
  Map,
  MessageCircle,
  Settings,
} from "lucide-react-native";
import { Text, View } from "react-native";
import { darkColors, lightColors } from "../../../colors";
import CurvedTabBar from "../../../components/CurvedTabBar";
import { useTheme } from "../../../utils/context/theme";

function TabIcon({ Icon, color }) {
  return (
    <View className="w-11 h-11 items-center justify-center">
      <Icon color={color} size={22} />
    </View>
  );
}

function CenterNewButton({ colors }) {
  return (
    <View
      style={{
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MessageCircle color={colors.dark} size={26} strokeWidth={2.5} />
    </View>
  );
}

export default function TabsLayout() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const TAB_HEIGHT = 72;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          position: "absolute",
          bottom: 16,
          height: TAB_HEIGHT,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarContentContainerStyle: {
          backgroundColor: "transparent",
          paddingHorizontal: 18,
        },
        tabBarBackground: () => (
          <CurvedTabBar colors={colors} height={TAB_HEIGHT} />
        ),
        tabBarItemStyle: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        tabBarIconStyle: {
          marginTop: 7,
        },
        tabBarLabelStyle: {
          marginTop: 0,
          fontSize: 10,
          fontWeight: "700",
          backgroundColor: "transparent",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabIcon Icon={Home} color={color} />,
        }}
      />

      <Tabs.Screen
        name="complaints"
        options={{
          title: "Complaints",
          tabBarIcon: ({ color }) => (
            <TabIcon Icon={ListChecks} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="assistant"
        options={{
          title: "",
          tabBarIcon: () => (
            <View style={{ position: "absolute", top: -40 }}>
              <CenterNewButton colors={colors} />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />

      <Tabs.Screen
        name="heatmap"
        options={{
          title: "Heat Map",
          tabBarIcon: ({ color }) => <TabIcon Icon={Map} color={color} />,
        }}
      />

      <Tabs.Screen
        name="setting"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <TabIcon Icon={Settings} color={color} />,
        }}
      />
    </Tabs>
  );
}
