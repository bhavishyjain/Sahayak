import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Dimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import CustomPicker from "../../../components/CustomPicker";
import { GET_HEATMAP_URL } from "../../../url";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";

export default function HeatMap() {
  console.log("🗺️ HeatMap component rendered");

  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const webViewRef = useRef(null);

  const [filters, setFilters] = useState({
    department: "all",
    priority: "all",
    timeframe: "30days",
  });

  const [userLocation, setUserLocation] = useState(null);

  // Function to fetch user's current location
  const fetchUserLocation = useCallback(async () => {
    try {
      console.log("📍 Fetching location...");
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log("Permission status:", status);

      if (status !== "granted") {
        console.log("Location permission denied");
        return;
      }

      // Get current position with retry logic
      let retries = 3;
      let location = null;

      while (retries > 0 && !location) {
        try {
          console.log(`Attempting to get location (${4 - retries}/3)...`);
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 15000,
            maximumAge: 10000,
          });

          if (location) {
            console.log("✅ Location fetched successfully:", location.coords);
            setUserLocation({
              lat: location.coords.latitude,
              lng: location.coords.longitude,
            });
            break;
          }
        } catch (err) {
          retries--;
          console.log(
            `Location attempt failed: ${err.message}, retries left: ${retries}`,
          );

          if (retries > 0) {
            // Wait 1 second before retrying
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } else {
            // Try last known position as fallback
            console.log("Trying last known position...");
            const lastKnown = await Location.getLastKnownPositionAsync({
              maxAge: 300000, // 5 minutes
            });

            if (lastKnown) {
              console.log("✅ Using last known position");
              setUserLocation({
                lat: lastKnown.coords.latitude,
                lng: lastKnown.coords.longitude,
              });
            } else {
              console.log("⚠️ No location available, using default");
            }
          }
        }
      }
    } catch (error) {
      console.log("❌ Error in fetchUserLocation:", error.message);
    }
  }, []);

  // Fetch location whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("🌍 HeatMap screen focused, fetching location...");
      fetchUserLocation();
    }, [fetchUserLocation]),
  );

  // Update map when user location changes
  useEffect(() => {
    if (userLocation && webViewRef.current) {
      const updateScript = `
        if (typeof map !== 'undefined' && typeof userLocation !== 'undefined') {
          userLocation = { lat: ${userLocation.lat}, lng: ${userLocation.lng} };
          
          // Remove old marker if exists
          map.eachLayer(function(layer) {
            if (layer instanceof L.Marker && layer.options.icon && layer.options.icon.options.className === 'user-location-marker') {
              map.removeLayer(layer);
            }
          });
          
          // Add new marker
          L.marker([${userLocation.lat}, ${userLocation.lng}], {
            icon: L.divIcon({
              className: 'user-location-marker',
              html: '<div style="background-color: #3B82F6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>',
              iconSize: [22, 22],
              iconAnchor: [11, 11]
            })
          })
          .addTo(map)
          .bindPopup('Your Location');
          
          // Center map on user location
          map.setView([${userLocation.lat}, ${userLocation.lng}], 15, {
            animate: true,
            duration: 0.5
          });
        }
        true;
      `;
      webViewRef.current.injectJavaScript(updateScript);
    }
  }, [userLocation]);

  // Fetch heatmap data
  const {
    data: heatmapData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["heatmap", filters],
    queryFn: async () => {
      console.log("🔄 Fetching heatmap data...");
      const response = await apiCall({
        method: "GET",
        url: GET_HEATMAP_URL,
      });
      console.log("✅ Heatmap data received:", response.data);
      return response.data;
    },
    retry: 1,
  });

  const spots = heatmapData?.spots || [];

  console.log("📊 Heatmap State:", {
    isLoading,
    spotsCount: spots.length,
    hasData: !!heatmapData,
    userLocation,
    firstSpot: spots[0],
  });

  const stats = {
    total: spots.reduce((sum, s) => sum + s.totalComplaints, 0),
    open: spots.reduce((sum, s) => sum + s.openComplaints, 0),
    highPriority: spots.reduce((sum, s) => sum + s.highPriorityComplaints, 0),
    hotspots: spots.filter(
      (s) => s.severity === "very-high" || s.severity === "high",
    ).length,
  };

  // Filter options
  const departments = [
    { label: t("all_departments") || "All Departments", value: "all" },
    { label: t("roads") || "Roads", value: "road" },
    { label: t("water") || "Water Supply", value: "water" },
    { label: t("electricity") || "Electricity", value: "electricity" },
    { label: t("waste") || "Waste Management", value: "waste" },
    { label: t("drainage") || "Drainage", value: "drainage" },
    { label: t("other") || "Other", value: "other" },
  ];

  const priorities = [
    { label: t("all_priorities") || "All Priorities", value: "all" },
    { label: t("high") || "High", value: "High" },
    { label: t("medium") || "Medium", value: "Medium" },
    { label: t("low") || "Low", value: "Low" },
  ];

  const timeframes = [
    { label: t("last_7_days") || "Last 7 Days", value: "7days" },
    { label: t("last_30_days") || "Last 30 Days", value: "30days" },
    { label: t("last_3_months") || "Last 3 Months", value: "3months" },
    { label: t("last_6_months") || "Last 6 Months", value: "6months" },
  ];

  // Generate Leaflet map HTML
  const generateMapHTML = () => {
    const mapCenter = userLocation
      ? [userLocation.lat, userLocation.lng]
      : [22.7196, 75.8577]; // Indore as default

    const markers = spots
      .map(
        (spot, index) => `
        L.circleMarker([${spot.coordinates?.lat || 0}, ${spot.coordinates?.lng || 0}], {
          color: '${getSeverityColor(spot.severity)}',
          fillColor: '${getSeverityColor(spot.severity)}',
          fillOpacity: 0.6,
          radius: Math.min(${spot.totalComplaints} * 2 + 5, 20)
        })
        .addTo(map)
        .bindPopup(\`
          <div style="font-family: system-ui; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${spot.locationName}</h3>
            <div style="font-size: 12px; color: #4b5563; line-height: 1.6;">
              <div><strong>Total Complaints:</strong> ${spot.totalComplaints}</div>
              <div><strong>Open:</strong> ${spot.openComplaints}</div>
              <div><strong>High Priority:</strong> ${spot.highPriorityComplaints}</div>
              <div><strong>Department:</strong> ${spot.topDepartment}</div>
              <div><strong>Severity:</strong> <span style="color: ${getSeverityColor(spot.severity)}; font-weight: 600;">${getSeverityLabel(spot.severity)}</span></div>
            </div>
          </div>
        \`);
      `,
      )
      .join("");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Heat Map</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { height: 100vh; width: 100%; }
          .legend {
            position: absolute;
            bottom: 20px;
            right: 10px;
            background: white;
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            font-family: system-ui;
            font-size: 11px;
            z-index: 1000;
          }
          .legend-title {
            font-weight: 600;
            margin-bottom: 6px;
            color: #1f2937;
            font-size: 12px;
          }
          .legend-item {
            display: flex;
            align-items: center;
            margin-bottom: 4px;
          }
          .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 6px;
            border: 1px solid rgba(0,0,0,0.1);
          }
          .current-location-btn {
            position: absolute;
            bottom: 20px;
            left: 10px;
            width: 44px;
            height: 44px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 1000;
            border: none;
          }
          .current-location-btn:active {
            background: #f3f4f6;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <button class="current-location-btn" onclick="goToUserLocation()">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="3" fill="#3B82F6"/>
            <path d="M12 2v4M12 18v4M22 12h-4M6 12H2" stroke="#3B82F6" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <div class="legend">
          <div class="legend-title">Severity Levels</div>
          <div class="legend-item">
            <div class="legend-color" style="background-color: #DC2626;"></div>
            <span>Critical</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background-color: #F59E0B;"></div>
            <span>High</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background-color: #10B981;"></div>
            <span>Medium</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background-color: #3B82F6;"></div>
            <span>Low</span>
          </div>
        </div>
        <script>
          const map = L.map('map').setView([${mapCenter[0]}, ${mapCenter[1]}], 12);
          
          L.tileLayer('https://maps.dkpg.xyz/get-map-tile.php?x={x}&y={y}&z={z}&lyrs=h', {
            attribution: '',
            maxZoom: 19
          }).addTo(map);

          // Store user location as JavaScript variable
          const userLocation = ${userLocation ? `{ lat: ${userLocation.lat}, lng: ${userLocation.lng} }` : "null"};

          ${
            userLocation
              ? `
          L.marker([${userLocation.lat}, ${userLocation.lng}], {
            icon: L.divIcon({
              className: 'user-location-marker',
              html: '<div style="background-color: #3B82F6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>',
              iconSize: [22, 22],
              iconAnchor: [11, 11]
            })
          })
          .addTo(map)
          .bindPopup('Your Location');
          `
              : ""
          }

          ${markers}

          // Function to center map on user location
          function goToUserLocation() {
            if (userLocation) {
              map.setView([userLocation.lat, userLocation.lng], 15, {
                animate: true,
                duration: 0.5
              });
            } else {
              // Send message to React Native to request location
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'requestLocation' }));
              }
            }
          }
        </script>
      </body>
      </html>
    `;
  };

  // Get severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case "very-high":
        return "#DC2626";
      case "high":
        return "#F59E0B";
      case "medium":
        return "#10B981";
      case "low":
        return "#3B82F6";
      default:
        return "#6B7280";
    }
  };

  const getSeverityLabel = (severity) => {
    switch (severity) {
      case "very-high":
        return "Critical";
      case "high":
        return "High";
      case "medium":
        return "Medium";
      case "low":
        return "Low";
      default:
        return "Normal";
    }
  };

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Handle messages from WebView
  const handleWebViewMessage = useCallback(
    async (event) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        if (message.action === "requestLocation") {
          console.log("🔄 Location requested from WebView");
          await fetchUserLocation();
        }
      } catch (error) {
        console.log("Error handling webview message:", error);
      }
    },
    [fetchUserLocation],
  );

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader
        title={t("heatmap") || "Heat Map"}
        hasBackButton={false}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Debug Info */}
        <View className="px-4 pt-4">
          <View
            className="p-3 rounded-lg mb-2"
            style={{ backgroundColor: colors.cardBackground }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 12 }}>
              🐛 Debug: Loading={isLoading ? "Yes" : "No"} | Spots=
              {spots.length} | Location=
              {userLocation
                ? `${userLocation.lat.toFixed(2)}, ${userLocation.lng.toFixed(2)}`
                : "None"}
            </Text>
          </View>
        </View>

        {/* Filters */}
        <View className="px-4 mb-4">
          <View
            className="p-4 rounded-xl"
            style={{ backgroundColor: colors.cardBackground }}
          >
            <Text
              style={{ color: colors.textPrimary }}
              className="text-lg font-bold mb-4"
            >
              {t("filters") || "Filters"}
            </Text>

            <View className="flex-row gap-2">
              <View style={{ flex: 1 }}>
                <CustomPicker
                  placeholder={t("department") || "Department"}
                  value={filters.department}
                  onChange={(item) => updateFilter("department", item.value)}
                  data={departments}
                  searchPlaceholder={null}
                />
              </View>

              <View style={{ flex: 1 }}>
                <CustomPicker
                  placeholder={t("priority") || "Priority"}
                  value={filters.priority}
                  onChange={(item) => updateFilter("priority", item.value)}
                  data={priorities}
                  searchPlaceholder={null}
                />
              </View>

              <View style={{ flex: 1 }}>
                <CustomPicker
                  placeholder={t("time_period") || "Time Period"}
                  value={filters.timeframe}
                  onChange={(item) => updateFilter("timeframe", item.value)}
                  data={timeframes}
                  searchPlaceholder={null}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Leaflet Map */}
        <View className="px-4 mb-4">
          <View
            className="rounded-xl overflow-hidden"
            style={{
              backgroundColor: colors.cardBackground,
              height: Dimensions.get("window").height - 300,
              minHeight: 500,
            }}
          >
            {isLoading ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <ActivityIndicator size="large" color={colors.primary} />
                <Text
                  style={{ color: colors.textSecondary, marginTop: 10 }}
                  className="text-sm"
                >
                  {t("loading_map") || "Loading map..."}
                </Text>
              </View>
            ) : (
              <WebView
                ref={webViewRef}
                source={{ html: generateMapHTML() }}
                style={{ flex: 1 }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                onMessage={handleWebViewMessage}
                renderLoading={() => (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      justifyContent: "center",
                      alignItems: "center",
                      backgroundColor: colors.cardBackground,
                    }}
                  >
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
