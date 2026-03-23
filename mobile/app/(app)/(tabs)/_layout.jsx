import { Tabs } from "expo-router";
import {
  Home,
  ListChecks,
  Map,
  MessageCircle,
  Settings,
  ClipboardList,
  LayoutDashboard,
  Users,
  Trophy,
  Building2,
  Trash2,
} from "lucide-react-native";
import { View } from "react-native";
import { darkColors, lightColors } from "../../../colors";
import CurvedTabBar from "../../../components/CurvedTabBar";
import { useTheme } from "../../../utils/context/theme";
import getUserAuth from "../../../utils/userAuth";
import { useEffect, useState } from "react";

function TabIcon({ Icon, color }) {
  return (
    <View className="w-11 h-11 items-center justify-center">
      <Icon color={color} size={22} />
    </View>
  );
}

function CenterNewButton({ colors, icon: Icon = MessageCircle }) {
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
      <Icon color={colors.dark} size={26} strokeWidth={2.5} />
    </View>
  );
}

export default function TabsLayout() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkUserRole() {
      const user = await getUserAuth();
      setUserRole(user?.role || "user");
      setLoading(false);
    }
    checkUserRole();
  }, []);

  const TAB_HEIGHT = 72;

  const commonScreenOptions = {
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
  };

  if (loading) {
    return null; // or a loading screen
  }

  if (userRole === "admin") {
    return (
      <Tabs screenOptions={commonScreenOptions}>
        <Tabs.Screen
          name="admin-home"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color }) => (
              <TabIcon Icon={LayoutDashboard} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="admin-recycle-bin"
          options={{
            title: "Deleted",
            tabBarIcon: ({ color }) => (
              <TabIcon Icon={Trash2} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="admin-departments"
          options={{
            title: "",
            tabBarIcon: () => (
              <View style={{ position: "absolute", top: -40 }}>
                <CenterNewButton colors={colors} icon={Building2} />
              </View>
            ),
            tabBarLabel: () => null,
          }}
        />

        <Tabs.Screen
          name="heatmap"
          options={{
            title: "Map",
            tabBarIcon: ({ color }) => <TabIcon Icon={Map} color={color} />,
          }}
        />

        <Tabs.Screen
          name="more"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => (
              <TabIcon Icon={Settings} color={color} />
            ),
          }}
        />

        <Tabs.Screen name="home" options={{ href: null }} />
        <Tabs.Screen name="complaints" options={{ href: null }} />
        <Tabs.Screen name="assistant" options={{ href: null }} />
        <Tabs.Screen name="worker-home" options={{ href: null }} />
        <Tabs.Screen name="worker-assigned" options={{ href: null }} />
        <Tabs.Screen name="worker-leaderboard" options={{ href: null }} />
        <Tabs.Screen name="hod-overview" options={{ href: null }} />
        <Tabs.Screen name="hod-workers" options={{ href: null }} />
        <Tabs.Screen name="hod-complaints" options={{ href: null }} />
      </Tabs>
    );
  }

  // Worker/HOD Tabs
  if (userRole === "worker") {
    return (
      <Tabs screenOptions={commonScreenOptions}>
        <Tabs.Screen
          name="worker-home"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color }) => (
              <TabIcon Icon={LayoutDashboard} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="worker-assigned"
          options={{
            title: "Assigned",
            tabBarIcon: ({ color }) => (
              <TabIcon Icon={ClipboardList} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="worker-leaderboard"
          options={{
            title: "",
            tabBarIcon: () => (
              <View style={{ position: "absolute", top: -40 }}>
                <CenterNewButton colors={colors} icon={Trophy} />
              </View>
            ),
            tabBarLabel: () => null,
          }}
        />

        <Tabs.Screen
          name="heatmap"
          options={{
            title: "Map",
            tabBarIcon: ({ color }) => <TabIcon Icon={Map} color={color} />,
          }}
        />

        <Tabs.Screen
          name="more"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => (
              <TabIcon Icon={Settings} color={color} />
            ),
          }}
        />

        {/* Hide unused tabs */}
        <Tabs.Screen name="home" options={{ href: null }} />
        <Tabs.Screen name="complaints" options={{ href: null }} />
        <Tabs.Screen name="assistant" options={{ href: null }} />
        <Tabs.Screen name="hod-overview" options={{ href: null }} />
        <Tabs.Screen name="hod-workers" options={{ href: null }} />
        <Tabs.Screen name="hod-complaints" options={{ href: null }} />
        <Tabs.Screen name="admin-recycle-bin" options={{ href: null }} />
      </Tabs>
    );
  }

  if (userRole === "head") {
    return (
      <Tabs screenOptions={commonScreenOptions}>
        <Tabs.Screen
          name="hod-overview"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color }) => (
              <TabIcon Icon={LayoutDashboard} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="hod-workers"
          options={{
            title: "Workers",
            tabBarIcon: ({ color }) => <TabIcon Icon={Users} color={color} />,
          }}
        />

        <Tabs.Screen
          name="hod-complaints"
          options={{
            title: "",
            tabBarIcon: () => (
              <View style={{ position: "absolute", top: -40 }}>
                <CenterNewButton colors={colors} icon={ListChecks} />
              </View>
            ),
            tabBarLabel: () => null,
          }}
        />

        <Tabs.Screen
          name="heatmap"
          options={{
            title: "Map",
            tabBarIcon: ({ color }) => <TabIcon Icon={Map} color={color} />,
          }}
        />

        <Tabs.Screen
          name="more"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => (
              <TabIcon Icon={Settings} color={color} />
            ),
          }}
        />

        {/* Hide unused tabs */}
        <Tabs.Screen name="home" options={{ href: null }} />
        <Tabs.Screen name="worker-home" options={{ href: null }} />
        <Tabs.Screen name="complaints" options={{ href: null }} />
        <Tabs.Screen name="assistant" options={{ href: null }} />
        <Tabs.Screen name="worker-assigned" options={{ href: null }} />
        <Tabs.Screen name="worker-leaderboard" options={{ href: null }} />
        <Tabs.Screen name="admin-home" options={{ href: null }} />
        <Tabs.Screen name="admin-recycle-bin" options={{ href: null }} />
        <Tabs.Screen name="admin-departments" options={{ href: null }} />
      </Tabs>
    );
  }

  // Default Citizen Tabs
  return (
    <Tabs screenOptions={commonScreenOptions}>
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
        name="more"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <TabIcon Icon={Settings} color={color} />,
        }}
      />

      {/* Hide worker/HOD tabs for citizens */}
      <Tabs.Screen name="worker-home" options={{ href: null }} />
      <Tabs.Screen name="worker-assigned" options={{ href: null }} />
      <Tabs.Screen name="worker-leaderboard" options={{ href: null }} />
      <Tabs.Screen name="hod-overview" options={{ href: null }} />
      <Tabs.Screen name="hod-workers" options={{ href: null }} />
      <Tabs.Screen name="hod-complaints" options={{ href: null }} />
      <Tabs.Screen name="admin-home" options={{ href: null }} />
      <Tabs.Screen name="admin-recycle-bin" options={{ href: null }} />
      <Tabs.Screen name="admin-departments" options={{ href: null }} />
    </Tabs>
  );
}
